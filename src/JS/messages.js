/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description: All the messages string used in the app
 * I = Informations, E = Errors, T = Titles, W = Webview, WA = Warning 
*/

const i = 'INFORMATION';
const e = 'ERROR';
const w = 'WARNING';

/* 
* Description: This is used to hold i, e and w messagess in the app
*/
const Messages = {
    I: {
        EngineStarted: `${i}: Limits Mate Engines have been started 🚀`,
        EngineShutDown: `${i}: Limits Mate Engines have been turned off 😴`,
        OperationCancelled: `${i}: Operation cancelled`,
        UnAbleToFetchLogs: `${i}: We regret to inform you that the generation of reports has failed. We kindly request that you verify if there is sufficient storage capacity available to create debug logs in your org.`,
        NoLogFilesPresent: `${i}: There are no log files to be deleted at this time.`,
        LogFilesDeleted: `${i}: The log files stored in the Limits Mate directory have been successfully deleted 🧹`,
        EngineSessionTimeOut: `${i}: The Limits Mate session has timed out. The Engines will now be turned off. You can restart them using the Start command.`
    },

    E: {
        EngineAlreadyRunning: `${e}: The Limits Mate Engines are already running.`,
        StopBeforeStart: `${e}: The Stop Engine command cannot be executed before the Start Engine command.`,
        ShowReportBeforeStart: `${e}: The Show Report command cannot be executed before the Start Engine command.`,  
        StopThenStop: `${e}: Limits Mate Engine have been already turned off.`,
        ErrorOnSfCliValidation: `${e}: Salesforce CLI not installed. Please ensure you have Salesforce CLI version 1.77.1 or above installed. You can verify the SF CLI version by entering the command: sf --version`,
        ErrorOnInit: `${e}: An error occured while starting the Limits Mate Engines. `,
        ErrorOnShut: `${e}: An error occured while turning off the Limits Mate Engines. `,
        ErrorOnShowReport: `${e}: An error occured while generating Governor Limits consumption reports. `,
        ErrorOnFetchUserInfo: `Please ensure that you are currently connected to this org and have the necessary permissions to view the object and fields.`,
        ErrorOnSettingDebugLogs: `Either no user activity happened or debug logs could not be created. Please ensure that your organization has enough storage space to create debug logs.`,
        ErrorOnExecutingSfCommand: `We encountered an issue while executing Salesforce CLI commands.`,
        ErrorOnDeletingLogs : `${e}: An error occurred while deleting the logs. Please check if the logs exist in the Limits Mate directory and if you have the necessary permissions to delete them.`,
        RefreshTokenInvalid: `Expired Refresh token. Please authorize your Salesforce org.`,
        ErrorOnSFCliMinVersion: `${e}: Please ensure that the Salesforce CLI has a minimum version of 1.77.1 or above. You can update the SF CLI by entering the command: sf update`,
        ErrorOnExecSFCliMinVersion: `Error while determing Sf CLI version`
    },

    T: {
        EngineStarting: `Starting Limits Mate Engines 🚀`,
        ShowingReport: `Computing Governor Limit consumption ✨ It may take a while ⏳`,
        RenderingReport: `Rendering Reports..`,
        StopEngine: `Turning off the Limits Mate Engines 😴`,
        DeletingLimitsMateLogs: `${i} : Deleting Limits Mate's captured logs..`
    },

    W: {
        GlReportViewTitle: `Governor Limits Consumption`
    }
}

/* 
* Description: This is used in view.js to display in the card 
*/
const GOVERNOR_LIMIT_DICTIONARY = {
	'Number of SOQL queries': 'SOQL Queries',
	'Number of query rows'	: 'Query Rows',
	'Number of SOSL queries': 'SOSL Queries',
	'Number of DML statements': 'DML Statements',
	'Number of Publish Immediate DML': 'Publish Immediate DML',
	'Number of DML rows': 'DML Rows',
	'Maximum CPU time': 'CPU Time',
	'Maximum heap size': 'Heap Size',
	'Number of callouts': 'Callouts',
	'Number of Email Invocations': 'Email Invocations',
	'Number of future calls': 'Future Calls',
	'Number of queueable jobs added to the queue': 'Queueable Jobs Added',
	'Number of Mobile Apex push calls': 'Mobile Apex Push Calls'
};
/* 
* Description: Method to show message on the vscode.window.withProgress 
*/
function showInformationMessage(vscode, msg) {
	vscode.window.showInformationMessage(msg);
}

/* 
* Description: Method to show message on the vscode.window.withProgress 
*/
function showErrorMessage(vscode, msg) {
	vscode.window.showErrorMessage(msg);
}

module.exports = {showInformationMessage, showErrorMessage, Messages, GOVERNOR_LIMIT_DICTIONARY}