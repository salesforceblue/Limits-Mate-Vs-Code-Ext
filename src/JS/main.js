// @ts-nocheck
/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description: main service
*/
const fs = require('fs');
const path = require('path');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const { showInformationMessage, showErrorMessage, Messages} = require('./messages.js');
const { consumptionToHtml, greenMessageToHtml, getErrorSummary} = require('./view.js');
const { Command} = require('./command.js');
const {isFileDownloaded} = require('./util.js');
const LOG_DIR_PATH = '.sf/tools/limitsmate/logs/'; 
const SESSION_AVAILABLE_FOR = 2 * 60 * 60 * 1000; // in ms
const REPORT_THRESHOLD_VALUE = 'limitsMate.reportThresholdValue';
// const NAMESPACE_VALUE = 'limitsMate.namespace'; // This can be handled in the subsquent release
const DEFAULT_NAMESPACE = `(default)`;
const DEFAULT_NAMESPACE_CAPS = `DEFAULT`;
const COUNT_CONCURRENT_LOG_DOWNLOAD = 10; // # logs would be fetched every LEG_FETCH_INTERVAL
const IS_WINDOWS = (process.platform === "win32");
const LOG_DURATION = 2; // in hour
const SF_MIN_VERSION_REQ = '1.77.1';
let namespace = DEFAULT_NAMESPACE;
let LOG_FETCH_INTERVAL = IS_WINDOWS ? 5 * 60 * 1000 : 2 * 60 * 1000; // in ms
let isStartEngineProcessed = false; 
let isStopEngineProcessed = false 
let isCurrentUserLogDownLoaded = false;
let limitsConsumptionByLogFile = new Map();
let initTimeStamp;
let userName;
let logFetchIntervalId;
let threshold;
let traceFlagId;
let vscode;
let context;
let autoShutDownEngineTimeOutId;
let lastFetchedLogTimeStamp;
let lookAheadLastModifiedDateTimeStamp;
let _lookAheadLastModifiedDateTimeStamp; //holds prior value
let userId;
let isSFDXActive = false; // This flag will be determining to execute sf or sfdx | Request user to install and update sf to version 1.77.1 or above to ensure smooth operation 
/*
* Description: Setting up the vscode context received from extensions.js
*/
function setVsCodeContext(vsCodeCtx, executionContext) {
    vscode = vsCodeCtx;
	context = executionContext;
}

/*
* Description: Initial set up when start engine is called
*/
async function init(vsCodeCtx, executionContext) {
	setVsCodeContext(vsCodeCtx, executionContext); 
	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: Messages.T.EngineStarting,
		cancellable: false
	}, async (progress, token) => {
		try {
			if(await onInitValidations()){return};
			setTimeStamp();
			await setTraceFlag();
			setFlagsOnInit();
			showInformationMessage(vscode, Messages.I.EngineStarted);
			schdeuleAutoShutDownEngines();
		} catch (error) {
			console.error(`an error occured while starting engines - ${error}`);
			showErrorMessage(vscode, error.message ? `${Messages.E.ErrorOnInit} ${error.message}` : Messages.E.ErrorOnInit);
		}
	});
}

/*
* Description: All the validations during start engine call
*/
function onInitValidations() {
	return new Promise(async (resolve, reject)=> {
		try {
			if(isStartEngineProcessed) {
				showErrorMessage(vscode, Messages.E.EngineAlreadyRunning );
				resolve(true);
				return true;
			}
			if(!await isSfCliInstalled()) {  // ensure that the SF Cli is installed and above 1.77.1 
				resolve(true); 
				return;
			}

			if(!await isSfHaveRequiredVersion()) {
				resolve(true); 
				return;
			}
		} catch (error) {
			reject(error);
			console.error(`error occured initValidations : ${error}`);
		}
		resolve(false); // SF CLI validation passed
	});
}


/*
* Description: This validates that SF Cli is installed with minimum version required
*/
function isSfHaveRequiredVersion() {
	return new Promise(async (resolve, reject) => {
		let err = false;
		try {
			const result = await Command.Validation.validateSfCliVersion(SF_MIN_VERSION_REQ);
			if (result) { 
				resolve(true);
			} else {
				resolve(false);
				err = true;
			}	
		} catch (error) {
			err = true;
			resolve(false); 
		}
		
		if(err) { 
			showErrorMessage(vscode, Messages.E.ErrorOnSFCliMinVersion);
		} 
	});
}


/*
* Description: Setting current timestamp when engine is started so it will allow to scan the logs which are stored post this timestamp
*/
function setTimeStamp() {
	initTimeStamp = Date.now();
}

/* 
* Description: Validations for showReport call
*/
function onShowReportValidations() {
	if(isStartEngineProcessed === false) {
		showErrorMessage(vscode, Messages.E.ShowReportBeforeStart);
		return true;
	}
	return false;
}

/* 
* Description: Entry method to be invoked from the activation command
*/
async function showReport(vsCodeCtx, executionContext) {
	try {
		setVsCodeContext(vsCodeCtx, executionContext);
		if(onShowReportValidations()) {return;}
		await vscode.window.withProgress({ // Getting the latest logs again when showReport() is called to ensure we always have the up to date generated logs
			location: vscode.ProgressLocation.Notification,
			title: Messages.T.ShowingReport,
			cancellable: false
		}, async (progress, token) => {
			await getLatestLogs(userId, true);
			setPriorValueToLookAheadLastModifiedTimeStamp();
			incrementLookAheadLastModifiedTimeStamp();
			setConfigurationValues(); // Fetching again in case it was updated by the user after starting engines
			resetExistingConsumptionData();
			await processLogs();
		});
	} catch (error) {
		console.error(`an error occured during showReport call : ${error}`);
		showErrorMessage(vscode, error.message ? `${Messages.E.ErrorOnShowReport} ${error.message}` : Messages.E.ErrorOnShowReport);
	}
}

/* 
* Description: Set the configuration values
*/
function setConfigurationValues() {
	threshold = vscode.workspace.getConfiguration().get(REPORT_THRESHOLD_VALUE); 
	// namespace = vscode.workspace.getConfiguration().get(NAMESPACE_VALUE).toUpperCase() === DEFAULT_NAMESPACE_CAPS ? DEFAULT_NAMESPACE : vscode.workspace.getConfiguration().get(NAMESPACE_VALUE);  // This can be handled in the subsquent release
	namespace = DEFAULT_NAMESPACE;
}

/* 
* Description: Incrementing lookahead timestamp 
*/
function incrementLookAheadLastModifiedTimeStamp() {
	if(!lookAheadLastModifiedDateTimeStamp) return;
	const incrementedDate = new Date(lookAheadLastModifiedDateTimeStamp);
	incrementedDate.setSeconds(incrementedDate.getSeconds() + 1);
	lookAheadLastModifiedDateTimeStamp = incrementedDate.toISOString().replace('Z', '+0000');
	const newDateStr = incrementedDate.toISOString();
}

/* 
* Description: Setting prior value of look ahead time stamp
*/
function setPriorValueToLookAheadLastModifiedTimeStamp() {
	if(!lookAheadLastModifiedDateTimeStamp) return;
	_lookAheadLastModifiedDateTimeStamp = lookAheadLastModifiedDateTimeStamp;
}

/* 
* Description : Clearing the fetching of logs at regular intervals 
*/
function clearLogFetchInterval() {
	// also clear it post 3 hour of default session time
	if(logFetchIntervalId) {clearInterval(logFetchIntervalId);} // clearing log fetch process set in init call
}

/* 
* Description: Resetting limitsConsumptionByLogFile such that earlier data store in this variable are cleared once the showReport is invoked again
*/
function resetExistingConsumptionData() {
	limitsConsumptionByLogFile.clear(); // Reset the map for fresh fetching during show report call
}

/* 
* Description: Iterate over the logs folder and process each one of them from the declared timestamp (global variable)
*/
function processLogs() {
	return new Promise((resolve, reject)=> {
		fs.readdir(LOG_DIR_PATH, async function (err, files) {
			if (err) {
				console.error(`Error In Reading Directory : ${err}`);
				reject(err);
				return;
			}
			const promises = []; // Using promise to resolve each async file request and once all promises are resolved calling the renderReport()
			
			console.log('Process Logs Size >>> ' + files.length);

			files.forEach(function (file) {
				promises.push(new Promise((resolve, reject) => {
					const filePath = path.join(LOG_DIR_PATH, file);
					fs.stat(filePath, (err, stats) => {
					  if (err) {
						reject(err);
						return;
					  }
					  if (stats.isFile() && stats.mtimeMs >= initTimeStamp) {
						fs.readFile(filePath, 'utf8', (err, data) => {
							if (err) {
								reject(err);
								return;
							}
							
							if(!isCurrentUserLogDownLoaded){isCurrentUserLogDownLoaded = true;}
							calculateConsumption(data, filePath); 
							resolve();
						});
					  } else {
						resolve();
					  }
					});
				}));	
			});
	
			await vscode.window.withProgress({
				location: vscode.ProgressLocation.Notification,
				title: Messages.T.RenderingReport,
				cancellable: false
			}, async (progress, token) => {
				try {
					await Promise.all(promises);
					renderReport(limitsConsumptionByLogFile);
					resolve();
				} catch (error) {
					console.error(`Error occured in processLogs() : ${error}`);
					reject(error);
				}
			});
		});
	})
}

/* 
* Description: Read log data and extract limits consumption
*/
function calculateConsumption(log, fileName) {	
	const splitDelimeter = `LIMIT_USAGE_FOR_NS|${namespace}|\n`; // LIMIT_USAGE_FOR_NS can be present multiple times in a log
	const splittedLogFile = log.split(splitDelimeter).slice(-1)[0];
	const limitsList = splittedLogFile.split('\n');
	const regexNumberOf = /(Number of(?:\s\w+)*): (\d+) out of (\d+)/;
	const regexMax = /(Maximum(?:\s\w+)*): (\d+) out of (\d+)/;
	let limitsConsumptionDataList = [];

	for(let data of limitsList) {
		data = data.trim();
		if(!data) break; // To prevent fetching other namespace entries which are below default name space
		const numberOfMatch = data.match(regexNumberOf);
		const maxOfMatch = data.match(regexMax);
		if(numberOfMatch) {
			let percentageConsumption = (parseInt(numberOfMatch[2])/parseInt(numberOfMatch[3]))*100;
			percentageConsumption = percentageConsumption % 1 === 0 ? percentageConsumption : percentageConsumption.toFixed(2);
			if(isNaN(parseInt(percentageConsumption)) || percentageConsumption < threshold) {
				continue;
			}
			limitsConsumptionDataList.push(
				new LimitsConsumptionData({
					Description: numberOfMatch[1].trim(),
					Consumed: numberOfMatch[2],
					Max: numberOfMatch[3],
					Percentage: percentageConsumption
				})
			);
		} else if(maxOfMatch) {
			let percentageConsumption = (parseInt(maxOfMatch[2])/parseInt(maxOfMatch[3]))*100;
			percentageConsumption = percentageConsumption % 1 === 0 ? percentageConsumption : percentageConsumption.toFixed(2);
			if(isNaN(parseInt(percentageConsumption))  || percentageConsumption < threshold) {
				continue;
			}

			limitsConsumptionDataList.push(
				new LimitsConsumptionData({
					Description: maxOfMatch[1].trim(),
					Consumed: maxOfMatch[2],
					Max: maxOfMatch[3],
					Percentage: percentageConsumption,
				})
			);
		}

	} 

	if(limitsConsumptionDataList.length === 0) return;
	limitsConsumptionByLogFile.set(fileName, limitsConsumptionDataList);
}

/*
* Description: Showing results in a web view
*/
function renderReport(limitsConsumptionByLogFile) {
	const panel = vscode.window.createWebviewPanel(
		'LimitsMateReportView',
		Messages.W.GlReportViewTitle,
		vscode.ViewColumn.One,
		{
			enableScripts: true,
			retainContextWhenHidden: true
		}
	);

	if(isCurrentUserLogDownLoaded === false && limitsConsumptionByLogFile.size === 0) {
		// showInformationMessage(vscode, Messages.I.UnAbleToFetchLogs);
		panel.webview.html = getErrorSummary(vscode, panel.webview, context);
	} else if(limitsConsumptionByLogFile.size === 0) {
		panel.webview.html = greenMessageToHtml(vscode, panel.webview, context, threshold);
	} else {
		panel.webview.html = consumptionToHtml(limitsConsumptionByLogFile, vscode, panel.webview, context, path, threshold);
	}
}

/* 
* Description: Checking if SFDX is installed 
*/
function isSFDXInstalled() { // deprecated
	return new Promise(async (resolve, reject) => {
		let err = false;
		try {
			const result = await Command.Validation.validateSfdx();
			if (result.trim() === '') { 
				resolve(false);
				err = true;
			} else {
				isSFDXActive = true;
				resolve(true);
			}	
		} catch (error) {
			err = true;
			resolve(false); // When a command is not found terminal throwed an error
		}

		if(err) {
			showErrorMessage(vscode, Messages.E.ErrorOnSfCliValidation);
		}
	});
}

/* 
* Description: Checking if Sf CLI is installed 
*/
function isSfCliInstalled() {
	return new Promise(async (resolve, reject) => {
		let err = false;
		try {
			const result = await Command.Validation.validateSfCli();
			if (result.trim() === '') { 
				resolve(false);
				err = true;
			} else {
				resolve(true);
			}	
		} catch (error) {
			err = true;
			resolve(false); // When a command is not found terminal throwed an error also in one system
		}

		if(err) { 
			showErrorMessage(vscode, Messages.E.ErrorOnSfCliValidation);
		} 
		
	});
}

/* 
* Description: Stop the engines which will reset the trace flags. Now user have to restart the engines if they stop
*/
async function stopEngine(vsCodeCtx, executionContext) {
	try {
		setVsCodeContext(vsCodeCtx, executionContext); 
		if(onStopEngineValidations()) {return;}
		await deleteTraceFlag();
		setFlagsOnStop();
		clearLogFetchInterval();
		showInformationMessage(vscode, Messages.I.EngineShutDown);
		cancelAutoShutDownEngines();
	} catch (error) {
		console.error(`An error occured while shutting down engines : ${error}`);		
		showErrorMessage(vscode, error.message ? `${Messages.E.ErrorOnShut} ${error.message}` : Messages.E.ErrorOnShut);
	}
}

/*
* Description: All the validations during start engine call
*/
function onStopEngineValidations() {
	if(!isStartEngineProcessed) {
		showErrorMessage(vscode, Messages.E.StopBeforeStart);
		return true;
	} else if(isStopEngineProcessed) {
		showErrorMessage(vscode, Messages.E.StopThenStop);
		return true;
	}
}

/* 
* Description: Reset the flags on stop which will mandate to start and stop the engine properly
*/
function setFlagsOnStop() {
	isStartEngineProcessed = false; 
	isStopEngineProcessed = true;
	isCurrentUserLogDownLoaded = false;
	lastFetchedLogTimeStamp = undefined;
	lookAheadLastModifiedDateTimeStamp = undefined;
}

/* 
* Description: Reset the flags on init which will prevent to start the engine and stop properly
*/
function setFlagsOnInit() {
	isStartEngineProcessed = true; 
	isStopEngineProcessed = false;
}

/* 
* Description: To delete the debug logs created for this session
*/
function deleteTraceFlag() {
	return new Promise(async (resolve, reject)=> {
		await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: Messages.T.StopEngine,
			cancellable: false
		}, async (progress, token) => {
			try{

				let result = await Command.Query.getTraceFlag(userId, isSFDXActive);
				let traceFlag = JSON.parse(result);
				if(traceFlag.result.totalSize === 0) {resolve(); return;} // As trace flag has been already deleted by some other process by user
				await Command.Delete.deleteTraceFlag(traceFlagId, isSFDXActive);
				resolve();
			} catch(error) {
				reject(error);
				console.error(`err in log deletewa : ${JSON.stringify(error)}`)
			};
		});
	})
}

/* 
* Description: To set the debug logs created for this session
*/
function setTraceFlag() {
	return new Promise(async (resolve, reject)=> {
		try {
			let stdout, stderr, debugLevelId, debugLevel, traceFlag;
			/* Querying Current User Id & User Name */
			stdout = await Command.Query.getLoggedInUserInfo(isSFDXActive);
			const orgDisplay = JSON.parse(stdout);
			userId = orgDisplay.result.id;
			userName = orgDisplay.result.username;
			if(userId.trim() === 'unknown') { // Salesforce session is not active
				reject({message: Messages.E.RefreshTokenInvalid});
				return;
			}
			/* Querying Existing Debug Levels */
			stdout  = await Command.Query.getDebugLevel(isSFDXActive);
			debugLevel = JSON.parse(stdout);
			if(debugLevel.result.totalSize === 0) {
				/*  If debug didn't exits create the new debug level and assign the debuglevelId else assign the existing debuglevel Id */
				stdout = await Command.Create.createDebugLevel(isSFDXActive);
				debugLevel = JSON.parse(stdout);
				debugLevelId = debugLevel.result.id;
			} else {
				debugLevelId = debugLevel.result.records[0].Id;
			}

			/* Querying any existing Trace flags  */
			stdout = await Command.Query.getTraceFlag(userId, isSFDXActive);
			traceFlag = JSON.parse(stdout);
			const now = new Date();
			now.setHours(now.getHours() + LOG_DURATION);
			const dateString = now.toUTCString();
			if(traceFlag.result.totalSize === 0) {
				/* If trace flag didn't exists with given debug level for current user then create a traceflag for duration of 3 hours for current logged in user */
				stdout = await Command.Create.createTraceFlag(userId, debugLevelId, dateString, isSFDXActive);
				traceFlagId = JSON.parse(stdout).result.id;
			} else {
				/* If trace flag exists with given debug level for current user then update the traceflag for duration of 3 hours for current logged in user */
				traceFlagId = traceFlag.result.records[0].Id;
				stdout = await Command.Update.updateTraceFlag(traceFlagId, debugLevelId, dateString, isSFDXActive);
			}

			/* Periodically fetching up the generated logs */
			logFetchIntervalId = setInterval(async ()=> {
				try{
					await getLatestLogs(userId, false);
				} catch(error) {
					console.error(`err in log fetch : ${error}`)
					// Increment the log fetch interval by a min in mac and in windows set it to 3 mins
				};
			}, LOG_FETCH_INTERVAL); 
			resolve();
		} catch (error) {
			console.error(`error : ${error}`);
			reject(error);
		}
	});
}

/* 
* Description: This will auto shut down engines after a fixed interval of 'SESSION_AVAILABLE_FOR' from the momemnt of executing start engine
*/
function schdeuleAutoShutDownEngines() {
	clearTimeout(autoShutDownEngineTimeOutId); // Reset if any existing schedule persists due to earlier invocations
	autoShutDownEngineTimeOutId = setTimeout(()=> {
		if(isStartEngineProcessed === true) { 
			stopEngine(vscode);
			showInformationMessage(vscode, Messages.I.EngineSessionTimeOut);
		}
	}, SESSION_AVAILABLE_FOR);
}

/* 
* Description: Cancel auto shut down in case user itself has shut down the engines
*/
function cancelAutoShutDownEngines() {
	clearTimeout(autoShutDownEngineTimeOutId);
}

/* 
* Description: To fetch the logs against logged in user
*/
function getLatestLogs(userId, fetchAllLogs) { // Fallback mechanism: Show report can fetch all the pending logs till that time stampe
	return new Promise(async (resolve, reject) => {
		try {
			// let userId = `0056T000008QKvj`;
			let stdout, stderr;
			stdout = await Command.Query.getLatestLogs(userId, COUNT_CONCURRENT_LOG_DOWNLOAD, fetchAllLogs, lastFetchedLogTimeStamp, lookAheadLastModifiedDateTimeStamp, initTimeStamp, isSFDXActive);
			let logsList = JSON.parse(stdout);
			let size = 0;
			if(logsList.result.totalSize === 0) {
				// console.log(`no logs available for fetchAll : ${fetchAllLogs}`);
			} else {
				// console.log(`Fetch Logs Recods : ${logsList.result.records.length} for FetchAllLogs: ${fetchAllLogs} `);
				if(!fetchAllLogs) {
					const timeStamp = logsList.result.records ? logsList.result.records[logsList.result.records.length - 1].LastModifiedDate : undefined; 								
					if(timeStamp !== _lookAheadLastModifiedDateTimeStamp) {
						lookAheadLastModifiedDateTimeStamp = timeStamp;
					}
					// console.log(`lookAheadLastModifiedDateTimeStamp: ${lookAheadLastModifiedDateTimeStamp}`);
				}
				for (let log of logsList.result.records) {
					lastFetchedLogTimeStamp = log.LastModifiedDate;
					if(isFileDownloaded(path.join(LOG_DIR_PATH, `${log.Id}.log`))) {
						continue;
					}
					// console.log(`Fetching log Id - ${log.Id} for Fetch All : ${fetchAllLogs}`);
					await Command.Fetch.fetchLog(log.Id, LOG_DIR_PATH, isSFDXActive); // To ensure during showReport all logs are downloaded before running consumptionReport
					size++;
				}
			}
			// console.log(`Log Fetched Size : ${size} for FetchAll: ${fetchAllLogs}`);
			// console.log(`Log lastFetchedLogTimeStamp : ${lastFetchedLogTimeStamp} for fetchAllLogs: ${fetchAllLogs}`);
			resolve();
		} catch (error) {
			console.error(`error in getUserLogs() : ${JSON.stringify(error)}`);
			reject(error);
		}
	});
}

/* 
* Description: Deleting existing logs files stored in LOG_DIR_PATH
*/
function deleteLogFiles(vsCodeCtx, executionContext) {
	setVsCodeContext(vsCodeCtx, executionContext); 

	vscode.window.withProgress({
		location: vscode.ProgressLocation.Notification,
		title: Messages.T.DeletingLimitsMateLogs,
		cancellable: false
	},async (progress, token) => {
		try {
			await new Promise((resolve, reject)=>{fs.readdir(LOG_DIR_PATH, (err, files) => {
				if (err) reject(err);
				if (files.length === 0) {
					showInformationMessage(vscode, Messages.I.NoLogFilesPresent);
					resolve();
					return;
				}
				for (const file of files) {
				  const filePath = path.join(LOG_DIR_PATH, file);
				  fs.unlink(filePath, (err) => {
					if (err) reject(err);
				  });
				}
				showInformationMessage(vscode, Messages.I.LogFilesDeleted);
				resolve();
			})});

		} catch (error) {  
			console.error(`an error occured while deleting logs - ${error}`);
			showErrorMessage(vscode, error.message ? `${Messages.E.ErrorOnDeletingLogs} ${error.message}` : Messages.E.ErrorOnInit);

		}
	});
}

/* 
* Description: Representation for consumption tupple
*/
class LimitsConsumptionData {
	constructor(
		{Description, Max, Consumed, Percentage}
	) {
		this.Description = Description;
		this.Max = Max;
		this.Consumed = Consumed;
		this.Percentage = Percentage;
	}
}

module.exports = {init, stopEngine, showReport, deleteLogFiles}

