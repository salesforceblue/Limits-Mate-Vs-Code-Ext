/*! 
 * Copyright 2023 Pankaj Agrahari
 * Released under the MIT license
 * Module Description: This module contains utlis method 
*/
const fs = require('fs');

/* 
* Description: This is a generic retry decorator for any function
*/
function makeFunctionRetryable(func, retries, delay) {
	let retryableFunc = function() {
		return new Promise(async (resolve, reject) => {
			try {
				const result = await func.bind(null, ...arguments).call();
				resolve(result);
			} catch (error) {
				if (retries <= 0) {
					reject(error); 
					return;
				}
				await new Promise((resolve) => setTimeout(resolve, delay));
				retries--;
				console.log(`retries count: ${retries}`);
				const result = await retryableFunc.bind(null, ...arguments).call().catch(error => {
					reject(error); 
					return;
				});
				resolve(result);
			}
		});
	};

	return retryableFunc;
}

/* 
* Description: Returns true if file is downloaded else false
*/
function isFileDownloaded(fileWithPath) {
	if (fs.existsSync(fileWithPath)) {
		return true;
	} else {
		return false;
	}
}

/* 
* Description: Compares two versions
*/
function compareVersions(versionA, versionB) {
    const a = versionA.split('.');
    const b = versionB.split('.');
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const numA = parseInt(a[i] || '0');
      const numB = parseInt(b[i] || '0');
      if (numA > numB) {
        return 1;
      } else if (numA < numB) {
        return -1;
      }
    }
    return 0;
  }

module.exports = {makeFunctionRetryable, isFileDownloaded, compareVersions}
  

