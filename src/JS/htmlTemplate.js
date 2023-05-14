/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description:This module include any HTML template or snippet to be consumed at View.js  
*/
let {Messages} = require('./messages.js');

let Page = {
	Header: `
	<!DOCTYPE html>
	<html>
	<head>
		<title>Computed Limits</title>
		<link rel="stylesheet" href="{cssPath}">
	</head>
	<body>
	<div class="wrapper">
		<header class="header">
			<h1>Limits Mate 🚀</h1>
		</header>
	`,

   Footer: `
   <footer class="footer">
	   <span>Powered by <a href="https://salesforceblue.com" target="_blank">salesforceblue.com</a></span>
   </footer>
   </div>`,

   Section: {
    GreenSummary: `<section class="section-summary">
	<div class="section-header">
		<h3>Summary:</h3>
	</div>
	<div class="summary">
	<div class="green-message"> Hey Rockstar, </div> 
	<div class="green-message"> You have done an awesome implementation 🎉🎉🎉 <br/> There were no instance of any governor limits consumption crossing the set threshold of {threshold}% </div> 
	<div class="green-message"> Regards,<br/> Limits Mate </div>
	</div>
	</section>`,

	Chart: `
	<section class="section-summary">
			<div class="section-header">
				<h2>Summary:</h2>
			</div>
			<div class="summary">
		<canvas id="myChart" style="width:100%;max-width:1000px"></canvas>
		</section>
		<script src="{chartJsPath}"></script>
		<script>
		var ctx = document.getElementById("myChart");
		var myChart = new Chart(ctx, {
			type: "bar",
			data: {
				labels: [{dataLabels}], 
				datasets: [{
					label: "Count",
					backgroundColor: "#3794ff",
					borderWidth: 1,
					hoverBackgroundColor: "#3794ff",
					hoverBorderColor: "#3794ff",
					scaleStepWidth: 1,
					data: [{limitsData}], 

				}]
			},
			options: { 
				legend: {display: false},
				title: {
				display: true,
				text: "Number Of Times Each Individual Governor Limits Was Utilised More Than The Set Threshold Value Of {threshold}%",
				fontColor: "#CCCCCC",
				fontSize: 14,
				},
				scales: {
					yAxes: [{
						ticks: {
							fontColor: "#CCCCCC",
							fontSize: 12,
							stepSize: 1,
							beginAtZero: true
						}
					}],
					xAxes: [{
						ticks: {
							fontColor: "#CCCCCC",
							fontSize: 12,
							stepSize: 1,
							beginAtZero: true
						}
					}]
				}
			}
		});
		</script>`
	},

	ErrorSummary:
	`<section class="section-summary">
	<div class="section-header">
		<h3>Summary:</h3>
	</div>
	<div class="summary">
		<div class="error-summary">
		<strong>Error:</strong> ${Messages.E.ErrorOnSettingDebugLogs}
		</div>
	</div>
	</section>`
	
}

module.exports = {Page}