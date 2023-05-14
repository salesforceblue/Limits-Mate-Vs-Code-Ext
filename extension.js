/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
*/
const vscode = require('vscode');
const { init, stopEngine, showReport, deleteLogFiles } = require('./src/JS/main.js');
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	context.subscriptions.push(vscode.commands.registerCommand('limitsmate.start', init.bind(null, vscode, context)));
	context.subscriptions.push(vscode.commands.registerCommand('limitsmate.stopengine', stopEngine.bind(null, vscode, context)));
	context.subscriptions.push(vscode.commands.registerCommand('limitsmate.showreport', showReport.bind(null, vscode, context)));
	context.subscriptions.push(vscode.commands.registerCommand('limitsmate.deleteLogFiles', deleteLogFiles.bind(null, vscode, context)));
}

function deactivate() {}

module.exports = {
	activate,
	deactivate
}


