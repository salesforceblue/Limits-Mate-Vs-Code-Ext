/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description: This module handle the Page specific rendering handling 
*/

const {Page} = require(`./htmlTemplate.js`);
const {GOVERNOR_LIMIT_DICTIONARY} = require(`./messages.js`);

/*
* Description: Set CSS path value
*/
function setCssPathInHeader(cssPath) {
	Page.Header = Page.Header.replace(`{cssPath}`, cssPath);
}

/* 
* Description: This function transform the consumption array list into a HTML Page format to be passed to webview
*/
function consumptionToHtml(limitsConsumptionByLogFile,vscode, webview, context, path, threshold) {
	let cssPath = webview.asWebviewUri(vscode.Uri.joinPath(
        context.extensionUri, '/src/CSS', 'master.css')); 

	let chartJsPath = webview.asWebviewUri(vscode.Uri.joinPath(
			context.extensionUri, '/src/JS', 'chart.js')); 
	setCssPathInHeader(cssPath);	

	let consumptionAggregateMap = new Map();
	
	let consumptionReportSection = `
		<section class="section-consumption">
			<div class="section-header">
				<h2>Run Time Limits Consumption For Individual Transaction:</h2>
			</div>
			<div class="consumption">`
			
	for(let logFileName of limitsConsumptionByLogFile.keys()) {
		consumptionReportSection += `
			
			<div class="card-container">`
		for(let limitsData of limitsConsumptionByLogFile.get(logFileName)) { // tupples for individual logs generate individual consumption cards
			let governorLimitDescription = GOVERNOR_LIMIT_DICTIONARY[limitsData.Description] ? GOVERNOR_LIMIT_DICTIONARY[limitsData.Description] : limitsData.Description;
			consumptionAggregateMap.get(governorLimitDescription) ? 
				consumptionAggregateMap.set(governorLimitDescription, consumptionAggregateMap.get(governorLimitDescription) + 1)  
				: consumptionAggregateMap.set(governorLimitDescription, 1);

				consumptionReportSection += `
				<div class="card">
					<h2>${governorLimitDescription}</h2>
					<p>Used: ${limitsData.Consumed} / ${limitsData.Max}</p>
					<div class="card-progress-bar">
						<div style="width: ${limitsData.Percentage}%"></div>
					</div>
					<div class="card-footer">
						<p><span class="count">${limitsData.Percentage}%</span> </p>
					</div>
				</div>`
		}
		consumptionReportSection += `
			</div>
			<div>
				<a class="view-log" href='vscode://file/${path.join(vscode.workspace.workspaceFolders[0].uri.fsPath, logFileName)}'>View Log</a>
			</div>
			<div class="card-separator"></div>`
	}
	
	consumptionReportSection += `
			</div>
		</section>`

	let consumptionSummarySection =  getChart(consumptionAggregateMap, chartJsPath, threshold);

	return Page.Header + consumptionSummarySection + consumptionReportSection + Page.Footer;
}

/* 
* Description: return the consumption summary chart
*/
function getChart(consumptionAggregateMap, chartJsPath, threshold) {

	let sectionSummary = Page.Section.Chart.replace('{threshold}', threshold)
						.replace('{chartJsPath}', chartJsPath)
						.replace('{dataLabels}', Array.from(consumptionAggregateMap.keys()).map(i => `'${i}'`).join(", "))
						.replace('{limitsData}', Array.from(consumptionAggregateMap.values()).join(", "));

	return sectionSummary;
}

/* 
* Description: return the message when implementation is in green  
*/
function greenMessageToHtml(vscode, webview, context, threshold) {
	let cssPath = webview.asWebviewUri(vscode.Uri.joinPath(
        context.extensionUri, '/src/CSS', 'master.css')); 
	setCssPathInHeader(cssPath);
	return Page.Header + Page.Section.GreenSummary.replace(`{threshold}`, threshold) + Page.Footer;
}

/* 
* Description: return the message when logs are not generated
*/
function getErrorSummary(vscode, webview, context) {
	let cssPath = webview.asWebviewUri(vscode.Uri.joinPath(
        context.extensionUri, '/src/CSS', 'master.css')); 
	setCssPathInHeader(cssPath);
	return Page.Header + Page.ErrorSummary + Page.Footer;
}

module.exports = {consumptionToHtml, greenMessageToHtml, getErrorSummary}

