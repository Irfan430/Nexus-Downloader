const axios = require('axios');
const puppeteer = require('puppeteer');
const config = require('../config');
const { detectPlatform } = require('../utils/urlDetector');

function launchOptions() {
  return {
    headless: 'new',
    executablePath: config.puppeteerExecutablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  };
}

const puppeteerEngine = {
  name: 'puppeteer',

  async isAvailable() {
    try {
      const browser = await puppeteer.launch(launchOptions());
      await browser.close();
      return true;
    } catch {
      return false;
    }
  },

  async info(url) {
    const browser = await puppeteer.launch(launchOptions());
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      const data = await page.evaluate(() => ({
        title: document.title || null,
        thumbnail: document.querySelector('meta[property="og:image"]')?.content || null,
        description: document.querySelector('meta[property="og:description"]')?.content || null
      }));
      return {
        success: true,
        engine: 'puppeteer',
        platform: detectPlatform(url),
        title: data.title,
        thumbnail: data.thumbnail,
        duration: null,
        uploader: null,
        view_count: null,
        formats: [{ id: 'page', quality: 'page', ext: 'html', filesize: null }],
        audio_formats: []
      };
    } finally {
      await browser.close();
    }
  },

  async download(url) {
    const response = await axios.get(url, { timeout: 45000, maxRedirects: 5 });
    return {
      success: true,
      engine: 'puppeteer',
      platform: detectPlatform(url),
      html: response.data
    };
  }
};

module.exports = puppeteerEngine;
