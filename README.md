# Behance Archive Downloader

A Node.js command line script that uses Puppeteer to download all livestream videos from a logged-in Behance user's profile.

## Why?

Behance has shut down personal livestreaming as of December 2024, and there is no way to bulk-download your videos from the platform. This script allows you to download your own livestreams for archival purposes.

## Requirements

- [Node.js](https://nodejs.org/) (tested with v22.12.0 LTS)

## Installation

1. Clone or download this repository and navigate to the project folder in your terminal
2. Run `npm install -g .` within the project folder to install the script globally

## Usage

Run the script with the following command:

```
behance-archive-downloader --user <username> --path <path>
```

Where `<username>` is your Behance username (you must be able to log in as this user), and `<path>` is the path to the directory where you want to save the videos.

The script will open a browser window and prompt you to log in to Behance. Note that the script does not store your login information, but it does store session cookies in the `_cookies.json` file in the download directory so that you do not have to log in each time if run the script more than once.

Once you are logged in, the script will navigate to your livestreams page, scroll down until all livestreams are loaded, and begin downloading all videos to the specified directory one at a time. The script will log the progress to the console.

Each file is renamed after the download is complete to include the livestream date and title: `YYYY-MM-DD - Livestream Title.mp4`. This way, the files will be sorted chronologically in the download directory.

Each video downloaded will have a line added to a `_videos.csv` file in the download directory with the video's original URL, UUID, title, date, duration, and the final filename of the downloaded video. Note that this file is used to track which videos have been downloaded so that if the script is stopped and restarted, it will not re-download videos that have already been downloaded.
