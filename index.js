#!/usr/bin/env node

/**
 * Behance Archive Downloader
 *
 * A script tthat uses Puppeteer to scrape a user's livestream archive at
 * https://www.behance.net/{user}/livestreams and download all videos, naming
 * each file with the date and title of the stream.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const sanitize = require('sanitize-filename');
const yargs = require('yargs');

const argv = yargs
	.usage('Usage: $0 --user [user]')
	.demandOption(['user'])
	.argv;

const user = argv.user;

(async() => {
	console.log('Launching Puppeteer...');

	const browser = await puppeteer.launch({
		headless: false, // User must log in, so we need to see the browser.
		defaultViewport: {
			width: 1200,
			height: 960,
		},
	});
	const page = await browser.newPage();

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

	// Wait for login button to appear.
	await page.waitForSelector('button.js-adobeid-signin[data-signin-from="Header"]');

	console.log('Logging in...');

	// Initiate user sign-in.
	await page.click('button.js-adobeid-signin[data-signin-from="Header"]');

	// Notify user to sign in.
	console.log('Please sign in to Behance.');

	// Wait for user to sign in by looking for the body.logged-in class.
	await page.waitForSelector('body.logged-in', { timeout: 0 });

	console.log('Signed in. Looking for livestreams...');

	// Wait for the user's livestream archive to load. The grid of videos has a className starting with "ContentGridLivestreams-grid-".
	await page.waitForSelector('[class^=ContentGridLivestreams-grid-]');

	console.log('Livestream archive loaded. Scraping videos...');

	await browser.close();
} )();
