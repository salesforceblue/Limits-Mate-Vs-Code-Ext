// @ts-nocheck
/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description: Execute the specific command string invoked from the caller
*/
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const {makeFunctionRetryable, compareVersions} = require('./util.js');
const { Messages } = require('./messages.js');
const RETRY = 3;
const IS_WINDOWS = (process.platform === "win32");
const RETRY_DELAY = IS_WINDOWS? 60 * 1000 : 30 * 1000; // in ms

class Command {
    static Fetch = class { 
        static fetchLog(logId, dirPath, isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? 
                        await Command._executeCommand()(`sfdx force:apex:log:get -d ${dirPath} -i ${logId}`)  
                        : await Command._executeCommand()(`sf apex get log -d ${dirPath} --log-id ${logId}`);
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        }
    }
    
    static Query = class {
        static getLoggedInUserInfo(isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? 
                        await Command._executeCommand()(`sfdx force:user:display --json`) 
                        : await Command._executeCommand()(`sf org display user --json`);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnFetchUserInfo});
                }
            });
        }

        static getDebugLevel(isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? 
                    await Command._executeCommand()(`sfdx force:data:soql:query -q "Select Id, DeveloperName FROM DebugLevel where  DeveloperName Like 'MyReplayDebuggerLM%' AND Visualforce = 'FINER' AND ApexCode = 'FINEST' LIMIT 1" --usetoolingapi --json`)
                    : await Command._executeCommand()(`sf data query --query "Select Id, DeveloperName FROM DebugLevel where  DeveloperName Like 'MyReplayDebuggerLM%' AND Visualforce = 'FINER' AND ApexCode = 'FINEST' LIMIT 1" --use-tooling-api --json`);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnFetchUserInfo});
                }
            });
        }

        static getTraceFlag(userId, isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? 
                    await Command._executeCommand()(`sfdx force:data:soql:query -q "SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}'" --usetoolingapi --json`)
                    : await Command._executeCommand()(`sf data query --query "SELECT id, logtype, startdate, expirationdate, debuglevelid, debuglevel.apexcode, debuglevel.visualforce FROM TraceFlag WHERE logtype='DEVELOPER_LOG' AND TracedEntityId='${userId}'" --use-tooling-api --json`);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnExecutingSfCommand});
                }
            });
        }
        
        static getLatestLogs(userId, count, fetchAllLogs, lastFetchedLogTimeStamp, lookAheadLastModifiedDateTimeStamp, initTimeStamp, isSFDXActive) {
            let commandString;
            if(lookAheadLastModifiedDateTimeStamp && !fetchAllLogs) { // This will be executed only when logs are fetched in async way so different batches will have unique set of logids to fetch asynchronously
                commandString = isSFDXActive ? `sfdx force:data:soql:query -q "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${lookAheadLastModifiedDateTimeStamp} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --usetoolingapi --json`  
                    : `sf data query --query "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${lookAheadLastModifiedDateTimeStamp} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --use-tooling-api --json`;

            } else if(lastFetchedLogTimeStamp) { // fetchAllLogs = false will it be ever exeucuted? // ON 2ND interval calls as lookAhead will be already populated so line 61 block would be exeucted in this case. This can ever be executed once lookAhead one becomes null which is only feasible when result.records is received blank from api which is already handled in the previous if block
                commandString = isSFDXActive ? `sfdx force:data:soql:query -q "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${lastFetchedLogTimeStamp} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --usetoolingapi --json`  
                    : `sf data query --query "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${lastFetchedLogTimeStamp} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --use-tooling-api --json`;

            } else {
                commandString = isSFDXActive ? `sfdx force:data:soql:query -q "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${new Date(initTimeStamp).toISOString().replace('Z', '+0000')} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --usetoolingapi --json`  
                    : `sf data query --query "Select Id, LastModifiedDate FROM ApexLog where  LogUserId = '${userId}' AND LastModifiedDate >= ${new Date(initTimeStamp).toISOString().replace('Z', '+0000')} Order By LastModifiedDate ${fetchAllLogs ? '': `LIMIT ${count}`}" --use-tooling-api --json`;
            }

            // console.log(`commandString : ${commandString}`);

            return new Promise(async (resolve, reject)=> {
                try {
                    const result = await Command._executeCommand()(commandString);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnExecutingSfCommand});
                }
            });
        }
    }
    
    static Create = class {
        static createDebugLevel(isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? await Command._executeCommand()(`sfdx force:data:record:create -s DebugLevel -v "developername=MyReplayDebuggerLMLevels${Date.now()} MasterLabel=MyReplayDebuggerLMLevels${Date.now()} apexcode=FINEST visualforce=FINER" --usetoolingapi --json`)
                        : await Command._executeCommand()(`sf data create record -s DebugLevel --values "developername=MyReplayDebuggerLMLevels${Date.now()} MasterLabel=MyReplayDebuggerLMLevels${Date.now()} apexcode=FINEST visualforce=FINER" --use-tooling-api --json`);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnExecutingSfCommand});
                }
            });
        }

        static createTraceFlag(userId, debugLevelId, dateString, isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? await Command._executeCommand()(`sfdx force:data:record:create -s TraceFlag -v "tracedentityid='${userId}' logtype='developer_log' debuglevelid='${debugLevelId}' StartDate='' ExpirationDate='${dateString}'" --usetoolingapi --json`)
                        : await Command._executeCommand()(`sf data create record -s TraceFlag --values "tracedentityid='${userId}' logtype='developer_log' debuglevelid='${debugLevelId}' StartDate='' ExpirationDate='${dateString}'" --use-tooling-api --json`);
                    resolve(result);
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnSettingDebugLogs});
                }
            });
        }
    }
    
    static Update = class {
        static updateTraceFlag(traceFlagId, debugLevelId, dateString, isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    
                    const result = isSFDXActive ? await Command._executeCommand()(`sfdx force:data:record:update -s TraceFlag -i ${traceFlagId} -v "StartDate='' ExpirationDate='${dateString}' debuglevelid='${debugLevelId}" --usetoolingapi --json`)
                        : await Command._executeCommand()(`sf data update record -s TraceFlag --record-id ${traceFlagId} --values "StartDate='' ExpirationDate='${dateString}' debuglevelid='${debugLevelId}" --use-tooling-api --json`);

                    resolve(result);
                    
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnExecutingSfCommand});            
                }
            });
        }
    }
   
    static Delete = class {
        static async deleteTraceFlag(traceFlagId, isSFDXActive) {
            return new Promise(async (resolve, reject)=> {
                try {
                    const result = isSFDXActive ? await Command._executeCommand()(`sfdx force:data:record:delete -s TraceFlag -i ${traceFlagId} --usetoolingapi`)
                        : await Command._executeCommand()(`sf data delete record -s TraceFlag -i ${traceFlagId} --use-tooling-api`);
                    resolve(result);
                    
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnExecutingSfCommand});
                }
            });
        }
    }

    static Validation = class {
        static async validateSfCli() { // This should ensure that SF Cli is installed and using version 1.77.1 and above 
            return new Promise(async (resolve, reject)=> {
                try {
                    // console.log(`is Windows: ${IS_WINDOWS}`);
                    let commandString = IS_WINDOWS ? `where sf` : `which sf`;
                    const result = await Command._executeCommand()(commandString); 
                    // console.log('validate CLI resluts > ' + result);
                    resolve(result);
                } catch (error) {
                    console.error(`error on executing validateSfCLi: ${error}`);
                    reject({error: error, message: Messages.E.ErrorOnSfCliValidation});
                }
            });
        }

        static async validateSfCliVersion(minVersion) { // This should ensure that SF Cli is installed and using version 1.77.1 and above 
            return new Promise(async (resolve, reject)=> {
                try {
                    // console.log(`is Windows: ${IS_WINDOWS}`);
                    let commandString = `sf --version`;
                    const result = await Command._executeCommand()(commandString); 
                    const versionOutput = result.toString().trim();
                    const versionRegex = /@salesforce\/cli\/(\d+\.\d+\.\d+)/;
                    const versionMatch = versionRegex.exec(versionOutput);
                
                    if (versionMatch) {
                        const sfCliVersion = versionMatch[1];
                        if (compareVersions(sfCliVersion, minVersion) >= 0) {
                            resolve(true);
                        } else {
                            resolve(false);
                        }
                    } else {
                        console.error('Unable to determine Salesforce CLI version.');
                        resolve(false);
                    }
                    
                } catch (error) {
                    console.error(`error on executing validateSfCLi: ${error}`);
                    reject({error: error, message: Messages.E.ErrorOnExecSFCliMinVersion});
                }
            });
        }

        static async validateSfdx() { // deprecated
            return new Promise(async (resolve, reject)=> {
                try {
                    let commandString = IS_WINDOWS ? `where sfdx` : `where sfdx`;
                    const result = await Command._executeCommand()(commandString);
                    resolve(result);
                    
                } catch (error) {
                    reject({error: error, message: Messages.E.ErrorOnSfCliValidation});
                }
            });
        }
    }

    /* 
    * Description: This method would be invoking the sf command  
    */
    static _executeCommand() { return makeFunctionRetryable((command)=> {
        return new Promise(async (resolve, reject) => {
            try {
                let {stdout, stderr} = await exec(command);
                resolve(stdout);
            } catch (error) {
                console.error('an error occured in executing sf cli commands ' + JSON.stringify(error));
                reject(error);
            }
        });
        }, RETRY, RETRY_DELAY);
    }
}

module.exports = {Command}
