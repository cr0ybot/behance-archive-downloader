#!/usr/bin/env node

/**
 * Behance Archive Downloader
 *
 * A script tthat uses Puppeteer to scrape a user's livestream archive at
 * https://www.behance.net/{user}/livestreams and download all videos, naming
 * each file with the date and title of the stream.
 */

const puppeteer = require('puppeteer');
const fs = require('fs/promises');
const path = require('path');
const sanitize = require('sanitize-filename');
const yargs = require('yargs');

const argv = yargs
	.usage('Usage: $0 --user [user] --path [path]')
	.demandOption(['user', 'path'])
	.describe('user', 'The Behance user to scrape.')
	.describe('path', 'The path to save the downloaded videos.')
	.argv;

const user = argv.user;
const downloadDir = argv.path;

async function wait(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Save cookies to disk.
 *
 * @param {puppeteer.Browser} browser The browser object.
 * @param {string} cookiesPath The path to save the cookies to.
 */
async function saveCookies(browser, cookiesPath) {
	const cookies = await browser.cookies();
	const filename = path.join(cookiesPath, 'cookies.json');
	try {
		await fs.writeFile(filename, JSON.stringify(cookies, null, 2));
		return true;
	}
	catch (e) {
		return false;
	}
}

/**
 * Load cookies from disk if they exist.
 *
 * @param {puppeteer.Browser} browser The browser object.
 * @param {string} cookiesPath The path to load the cookies from.
 * @returns {boolean} True if cookies were loaded.
 */
async function loadCookies(browser, cookiesPath) {
	const filename = path.join(cookiesPath, 'cookies.json');
	try {
		const cookiesString = await fs.readFile(filename);
		const cookies = JSON.parse(cookiesString);
		await browser.setCookie(...cookies);
		return true;
	} catch (e) {
		return false;
	}
}

/**
 * Check if the user is logged in.
 *
 * @param {puppeteer.Page} page The Puppeteer page object.
 * @returns {boolean} True if the user is logged in.
 */
async function isLoggedIn(page) {
	return page.evaluate(() => document.body.classList.contains('logged-in'));
}

/**
 * Handles the login process for the user.
 *
 * @param {puppeteer.Page} page - The Puppeteer page object.
 */
async function handleLogin(page) {
	// Wait for login button to appear.
	await page.waitForSelector('button.js-adobeid-signin[data-signin-from="Header"]');
	await wait(1000);

	console.log('Initiating login...');

	// Initiate user sign-in.
	await page.click('button.js-adobeid-signin[data-signin-from="Header"]');

	// Notify user to sign in.
	console.log('Please sign in to Behance.');

	// Wait for user to sign in by looking for the body.logged-in class.
	await page.waitForSelector('body.logged-in', { timeout: 0 });

	console.log('User is logged in.');
}

/**
 * Load all videos by scrolling to the bottom of the page.
 */
async function loadAllVideos() {
	const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

	await (async() => {
		window.atBottom = false;
		const scroller = document.documentElement;
		let lastPosition = -1;
		while (!window.atBottom) {
			scroller.scrollTop += scroller.scrollHeight;
			await wait(1000);
			if (scroller.scrollTop === lastPosition) {
				window.atBottom = true;
			}
			lastPosition = scroller.scrollTop;
		}
	})();
}

/**
 * Extract video data from an ElementHandle.
 *
 * @param {puppeteer.ElementHandle} gridItem - The grid item element.
 * @returns {Object} The video data.
 */
async function extractVideoDataFromElementHandle(elementHandle) {
	// URL comes from the href attribute of the <a> tag.
	const url = await elementHandle.$eval('a', el => el.href);
	// UUID comes from the middle of the URL, after "/videos/" and before the next "/".
	const uuid = url.match(/\/videos\/([^/]+)/)[1];
	// Title comes from the title attribute of the <a> tag.
	const title = await elementHandle.$eval('a', el => el.title);
	// Date comes from the text of the "Card-name-*" element, after the '•'. Format may depend on user's locale.
	const rawDate = await elementHandle.$eval('[class^=Card-name-]', el => el.textContent.split('•')[1].trim());
	// Format the date as YYYY-MM-DD using the date object.
	const date = new Date(rawDate).toISOString().split('T')[0];
	// Duration comes from the text of the "Card-duration-*" element.
	const duration = await elementHandle.$eval('[class^=Duration-duration-]', el => el.textContent);

	console.log('Extracted video data:', { url, uuid, title, date, duration });

	return { url, uuid, title, date, duration };
}

/**
 * Scrape video data and download video, renaming the downloaded file with the
 * date and title.
 *
 * @param {puppeteer.ElementHandle} elementHandle - The element that contains the video.
 */
async function scrapeVideo(elementHandle, page, client, downloadDir) {
	// Return a promise early so that we can resolve only after the download is complete.
	return new Promise((resolve, reject) => {
		(async() => {
			const videoData = await extractVideoDataFromElementHandle(elementHandle);
			const { url, uuid, title, date, duration } = videoData;
			let downloadFilename = '';

			console.log(`Downloading video: ${date} - ${title} (${uuid})...`);

			/**
			 * When a download is initiated, we need to intercept the filename that
			 * Chrome will use to save the file (the GUID).
			 */
			client.on('Browser.downloadWillBegin', ({ guid }) => {
				// Remove the listener after the download begins.
				client.removeAllListeners('Browser.downloadWillBegin');
				// Get the download event GUID since that will be used as the filename.
				downloadFilename = guid;
				console.log(`Download started: ${downloadFilename}`);
			});

			/**
			 * We then need to listen to the downloadProgress event in order to
			 * wait for the download to complete and rename the file.
			 */
			client.on('Browser.downloadProgress', response => {
				if (response.guid === downloadFilename && response.state === 'completed') {
					(async() => {
						// Remove the listener after the download completes.
						client.removeAllListeners('Browser.downloadProgress');

						console.log(`Download complete: ${downloadFilename}`);

						// Rename the file with the date and title.
						const filename = `${date} - ${sanitize(title)}.mp4`;
						const filepath = path.join(downloadDir, filename);

						await fs.rename(path.join(downloadDir, downloadFilename), filepath);

						console.log(`File renamed: ${filepath}`);
						resolve();
					})();
				}
			});

			// Emulate a hover event to reveal the dropdown.
			page.evaluate(el => el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })), elementHandle);

			// Wait for the dropdown menu to appear.
			await page.waitForSelector('[class^=Tooltip-wrapper-]');

			// Emulate a hover event to reveal the menu.
			await elementHandle.$eval('[class^=Tooltip-wrapper-]', el => el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true })));

			// Wait for the menu to appear.
			await elementHandle.waitForSelector('[class^=Tooltip-wrapper-] ul');

			// Click the anchor element in the 3rd list item to initiate the download.
			const downloadButton = await elementHandle.$('[class^=Tooltip-wrapper-] ul li:nth-child(3) a');
			await downloadButton.click();
		})();
	});
}

(async() => {
	console.log('Verifying download directory...');

	// Create a directory for downloads if it doesn't exist.
	const downloadDirExists = await fs.access(downloadDir).then(() => true).catch(() => false);
	if (!downloadDirExists) {
		console.log('Creating download directory...');
		try {
			await fs.mkdir(downloadDirExists);
		} catch (e) {
			console.error('Failed to create download directory. Please choose a writable path.');
			return;
		}
	}

	console.log('Launching Puppeteer...');

	const browser = await puppeteer.launch({
		headless: false, // User must log in, so we need to see the browser.
		defaultViewport: {
			width: 1200,
			height: 960,
		},
	});
	const page = await browser.newPage();

	/**
	 * We are not provided a URL to download the video file directly. Instead,
	 * we must use Puppeteer to hover and click on specific elements to initiate
	 * the download. To set the download location, we must create a Chrome
	 * Devtools Protocol session and use the Page.setDownloadBehavior method.
	 */
	const client = await page.createCDPSession();
	await client.send('Browser.setDownloadBehavior', {
		behavior: 'allowAndName', // Allow downloads and name the file with the GUID.
		downloadPath: downloadDir,
		eventsEnabled: true,
	});

	console.log('Restoring cookies if available...');
	const cookiesRestored = await loadCookies(browser, downloadDir);

	if (!cookiesRestored) {
		console.log('Cookies not found. You will be required to log in.');
	}

	console.log('Navigating to Behance user\'s livestreams page...');

	// Check for user's livestream archive.
	try {
		await page.goto(
			`https://www.behance.net/${user}/livestreams`,
			{ waitUntil: 'load' }
		);
	} catch (e) {
		console.error(`Behance user ${user} not found.`);
		await browser.close();
		return;
	}

	const loggedIn = await isLoggedIn(page);

	if (!loggedIn) {
		console.log('User is not logged in.');

		await handleLogin(page);
	}
	else {
		console.log('User is already logged in.');
	}

	console.log('Saving cookies...');
	const cookiesSaved = await saveCookies(browser, downloadDir);
	if (!cookiesSaved) {
		console.error('Failed to save cookies.');
	}

	console.log('Looking for livestreams...');

	// Wait for the user's livestream archive to load. The grid of videos has a className starting with "ContentGridLivestreams-grid-".
	await page.waitForSelector('[class^=ContentGridLivestreams-grid-]');

	console.log('Loading all videos...');

	// Continuously scroll down the page to load all videos.
	await page.evaluate(loadAllVideos);

	console.log('Videos loaded. Scraping... Please do not interact with the page.');

	// Get all grid items.
	const gridItems = await page.$$('[class^=ContentGridLivestreams-grid-] > div');

	// Extract video data from each grid item and download the video.
	for (const gridItem of gridItems) {
		await scrapeVideo(gridItem, page, client, downloadDir);
	}

	console.log('Scraping complete. Closing Puppeteer...');

	await browser.close();
} )();
