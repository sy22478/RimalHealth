#!/usr/bin/env tsx
/**
 * Smoke Test Script
 * 
 * Performs quick end-to-end tests on critical user flows
 * Run after deployment to verify basic functionality
 */

import { chromium, Browser, Page } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TIMEOUT = 30000;

interface TestResult {
  name: string;
  passed: boolean;
  duration: number;
  error?: string;
}

class SmokeTestSuite {
  private browser: Browser | null = null;
  private results: TestResult[] = [];

  async setup(): Promise<void> {
    console.log('🚀 Starting smoke tests...\n');
    this.browser = await chromium.launch({ headless: true });
  }

  async teardown(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
    }
    this.printResults();
  }

  private async runTest(name: string, testFn: (page: Page) => Promise<void>): Promise<void> {
    if (!this.browser) throw new Error('Browser not initialized');

    const startTime = Date.now();
    const page = await this.browser.newPage();
    
    try {
      await testFn(page);
      const duration = Date.now() - startTime;
      this.results.push({ name, passed: true, duration });
      console.log(`  ✅ ${name} (${duration}ms)`);
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.results.push({ name, passed: false, duration, error: errorMessage });
      console.log(`  ❌ ${name} (${duration}ms)`);
      console.log(`     Error: ${errorMessage}`);
    } finally {
      await page.close();
    }
  }

  async testHomepageLoads(): Promise<void> {
    await this.runTest('Homepage loads', async (page) => {
      await page.goto(BASE_URL, { timeout: TIMEOUT });
      await page.waitForSelector('h1', { timeout: TIMEOUT });
      
      const title = await page.title();
      if (!title.includes('Rimal Health')) {
        throw new Error(`Unexpected page title: ${title}`);
      }
    });
  }

  async testLoginPageAccessible(): Promise<void> {
    await this.runTest('Login page accessible', async (page) => {
      await page.goto(`${BASE_URL}/login`, { timeout: TIMEOUT });
      await page.waitForSelector('form, input[type="email"]', { timeout: TIMEOUT, state: 'visible' });
    });
  }

  async testSignupPageAccessible(): Promise<void> {
    await this.runTest('Signup page accessible', async (page) => {
      await page.goto(`${BASE_URL}/signup`, { timeout: TIMEOUT });
      await page.waitForSelector('form, input[type="email"]', { timeout: TIMEOUT, state: 'visible' });
    });
  }

  async testAboutPageLoads(): Promise<void> {
    await this.runTest('About page loads', async (page) => {
      await page.goto(`${BASE_URL}/about`, { timeout: TIMEOUT });
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
      
      const content = await page.content();
      if (!content.includes('About')) {
        throw new Error('About page content not found');
      }
    });
  }

  async testPricingPageLoads(): Promise<void> {
    await this.runTest('Pricing page loads', async (page) => {
      await page.goto(`${BASE_URL}/pricing`, { timeout: TIMEOUT });
      await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
      
      const content = await page.content();
      if (!content.includes('50')) {
        throw new Error('Pricing information not found');
      }
    });
  }

  async testHealthEndpoint(): Promise<void> {
    await this.runTest('Health endpoint responds', async (page) => {
      const response = await page.goto(`${BASE_URL}/api/health`, { timeout: TIMEOUT });
      
      if (!response) {
        throw new Error('No response from health endpoint');
      }
      
      if (response.status() !== 200) {
        throw new Error(`Health endpoint returned status ${response.status()}`);
      }
      
      const body = await response.json();
      if (body.status !== 'healthy' && body.status !== 'degraded') {
        throw new Error(`Health status: ${body.status}`);
      }
    });
  }

  async testContactPageLoads(): Promise<void> {
    await this.runTest('Contact page loads', async (page) => {
      await page.goto(`${BASE_URL}/contact`, { timeout: TIMEOUT });
      await page.waitForSelector('form', { timeout: TIMEOUT, state: 'visible' });
    });
  }

  async testNavigationWorks(): Promise<void> {
    await this.runTest('Navigation works', async (page) => {
      await page.goto(BASE_URL, { timeout: TIMEOUT });
      
      // Look for navigation links
      const navLinks = await page.$$('nav a, header a');
      if (navLinks.length === 0) {
        throw new Error('No navigation links found');
      }
      
      // Try clicking the first link
      const firstLink = navLinks[0];
      const href = await firstLink.getAttribute('href');
      
      if (href && !href.startsWith('http')) {
        await firstLink.click();
        await page.waitForLoadState('networkidle', { timeout: TIMEOUT });
      }
    });
  }

  async testStaticAssetsLoad(): Promise<void> {
    await this.runTest('Static assets load', async (page) => {
      await page.goto(BASE_URL, { timeout: TIMEOUT });
      
      // Check if CSS is loaded
      const stylesLoaded = await page.evaluate(() => {
        return document.styleSheets.length > 0;
      });
      
      if (!stylesLoaded) {
        throw new Error('No stylesheets loaded');
      }
    });
  }

  private printResults(): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 Smoke Test Results');
    console.log('='.repeat(50));
    
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const total = this.results.length;
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`\nTotal: ${total} tests`);
    console.log(`✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    if (failed > 0) {
      console.log('\n🔴 Failed Tests:');
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          console.log(`  - ${r.name}: ${r.error}`);
        });
    }
    
    console.log('\n' + '='.repeat(50));
    
    if (failed > 0) {
      console.log('❌ Smoke tests FAILED');
      process.exit(1);
    } else {
      console.log('✅ All smoke tests PASSED');
      process.exit(0);
    }
  }

  async runAll(): Promise<void> {
    await this.setup();
    
    try {
      await this.testHomepageLoads();
      await this.testHealthEndpoint();
      await this.testLoginPageAccessible();
      await this.testSignupPageAccessible();
      await this.testAboutPageLoads();
      await this.testPricingPageLoads();
      await this.testContactPageLoads();
      await this.testNavigationWorks();
      await this.testStaticAssetsLoad();
    } finally {
      await this.teardown();
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const suite = new SmokeTestSuite();
  suite.runAll().catch((error) => {
    console.error('Smoke test suite failed:', error);
    process.exit(1);
  });
}

export { SmokeTestSuite };
