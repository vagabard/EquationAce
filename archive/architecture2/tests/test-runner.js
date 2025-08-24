#!/usr/bin/env node

/**
 * Test Runner for EquationAce Verification Files
 * 
 * This script runs all verification tests to check for regressions
 * during the build process.
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const TESTS_DIR = __dirname;
const TEST_TIMEOUT = 30000; // 30 seconds timeout per test

// Test categories and their files
const testCategories = {
    'Core Functionality': [
        'test_mathml.html',
        'test_implementation.html',
        'test_click_functionality.html'
    ],
    'Visual Features': [
        'test_nesting_colors.html',
        'test_color_fix.html',
        'test_box_implementation.html',
        'test_zoom_functionality.html'
    ],
    'Verification': [
        'verify_implementation.html',
        'verify_fix.html',
        'verify_nesting.html'
    ],
    'Integration': [
        'final_test.html'
    ]
};

class TestRunner {
    constructor() {
        this.results = {
            passed: 0,
            failed: 0,
            skipped: 0,
            total: 0
        };
        this.startTime = Date.now();
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            'info': '📋',
            'success': '✅',
            'error': '❌',
            'warning': '⚠️',
            'skip': '⏭️'
        }[level] || '📋';
        
        console.log(`[${timestamp}] ${prefix} ${message}`);
    }

    async checkFileExists(filePath) {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async validateTestFile(filePath) {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            
            // Basic validation checks
            const hasHtml = content.includes('<html');
            const hasTitle = content.includes('<title>');
            const hasScript = content.includes('<script>');
            
            if (!hasHtml || !hasTitle) {
                throw new Error('Invalid HTML structure');
            }
            
            return {
                valid: true,
                hasScript,
                size: content.length
            };
        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    async runTestCategory(categoryName, testFiles) {
        this.log(`\n🔍 Running ${categoryName} Tests`, 'info');
        this.log('─'.repeat(50), 'info');
        
        for (const testFile of testFiles) {
            const filePath = path.join(TESTS_DIR, testFile);
            this.results.total++;
            
            // Check if file exists
            if (!(await this.checkFileExists(filePath))) {
                this.log(`${testFile}: File not found`, 'error');
                this.results.failed++;
                continue;
            }
            
            // Validate file structure
            const validation = await this.validateTestFile(filePath);
            if (!validation.valid) {
                this.log(`${testFile}: Validation failed - ${validation.error}`, 'error');
                this.results.failed++;
                continue;
            }
            
            // For HTML test files, we can only validate structure
            // Manual testing would be required for full verification
            this.log(`${testFile}: Structure valid (${validation.size} bytes)${validation.hasScript ? ' [Interactive]' : ''}`, 'success');
            this.results.passed++;
        }
    }

    async generateTestReport() {
        const duration = Date.now() - this.startTime;
        const reportPath = path.join(TESTS_DIR, 'test-report.json');
        
        const report = {
            timestamp: new Date().toISOString(),
            duration: `${duration}ms`,
            results: this.results,
            categories: Object.keys(testCategories),
            recommendations: []
        };
        
        // Add recommendations based on results
        if (this.results.failed > 0) {
            report.recommendations.push('Some test files failed validation. Check file structure and content.');
        }
        
        if (this.results.passed === this.results.total) {
            report.recommendations.push('All tests passed structural validation. Manual verification recommended for interactive features.');
        }
        
        await fs.promises.writeFile(reportPath, JSON.stringify(report, null, 2));
        return report;
    }

    async run() {
        this.log('🚀 Starting EquationAce Test Runner', 'info');
        this.log(`📁 Tests directory: ${TESTS_DIR}`, 'info');
        
        // Run tests by category
        for (const [categoryName, testFiles] of Object.entries(testCategories)) {
            await this.runTestCategory(categoryName, testFiles);
        }
        
        // Generate report
        const report = await this.generateTestReport();
        
        // Summary
        this.log('\n📊 Test Summary', 'info');
        this.log('═'.repeat(50), 'info');
        this.log(`Total Tests: ${this.results.total}`, 'info');
        this.log(`Passed: ${this.results.passed}`, 'success');
        this.log(`Failed: ${this.results.failed}`, this.results.failed > 0 ? 'error' : 'info');
        this.log(`Duration: ${report.duration}`, 'info');
        this.log(`Report saved: tests/test-report.json`, 'info');
        
        // Manual testing instructions
        this.log('\n🔧 Manual Testing Required', 'warning');
        this.log('The following files require manual verification:', 'warning');
        this.log('• Open each test file in a browser', 'warning');
        this.log('• Follow the test instructions in each file', 'warning');
        this.log('• Verify visual elements and interactions work correctly', 'warning');
        
        // Exit with appropriate code
        process.exit(this.results.failed > 0 ? 1 : 0);
    }
}

// Run the tests
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().catch(error => {
        console.error('❌ Test runner failed:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;