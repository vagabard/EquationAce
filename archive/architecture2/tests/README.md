# EquationAce Test Suite

This directory contains all verification and test files for the EquationAce project, organized to ensure proper regression testing during builds.

## Directory Structure

```
tests/
├── README.md                     # This documentation
├── test-runner.js               # Automated test runner script
├── test-report.json            # Generated test reports
│
├── Core Functionality Tests/
├── test_mathml.html            # MathML implementation tests
├── test_implementation.html    # Basic implementation verification
├── test_click_functionality.html # Click interaction tests
│
├── Visual Features Tests/
├── test_nesting_colors.html    # IBM color nesting tests
├── test_color_fix.html         # Color fix verification
├── test_box_implementation.html # Box styling tests
├── test_zoom_functionality.html # Zoom feature tests
│
├── Verification Tests/
├── verify_implementation.html   # Implementation verification
├── verify_fix.html             # Bug fix verification
├── verify_nesting.html         # Nesting logic verification
│
└── Integration Tests/
    └── final_test.html         # Complete feature integration test
```

## Running Tests

### Automated Testing

The test suite is integrated into the build process and runs automatically:

```bash
# Run tests only
npm run test

# Run tests as part of build process (automatic)
npm run build

# Run complete verification (automated + manual)
npm run verify
```

### Manual Testing

Some tests require manual verification in a browser:

```bash
# Open manual test interface
npm run test:manual

# Or open individual test files
start tests/final_test.html
```

## Test Categories

### 1. Core Functionality Tests
- **test_mathml.html**: Validates MathML rendering and structure
- **test_implementation.html**: Basic application functionality
- **test_click_functionality.html**: Interactive element testing

### 2. Visual Features Tests
- **test_nesting_colors.html**: IBM Carbon Design System color implementation
- **test_color_fix.html**: Color regression testing
- **test_box_implementation.html**: Visual styling verification
- **test_zoom_functionality.html**: Zoom controls and scaling

### 3. Verification Tests
- **verify_implementation.html**: Comprehensive implementation check
- **verify_fix.html**: Bug fix validation
- **verify_nesting.html**: Nesting logic verification

### 4. Integration Tests
- **final_test.html**: End-to-end feature validation

## Test Runner Features

The automated test runner (`test-runner.js`) provides:

- ✅ **File Structure Validation**: Ensures all test files are properly formatted
- 📊 **Categorized Testing**: Organizes tests by functionality
- 📋 **Detailed Reporting**: Generates JSON reports with timestamps and results
- ⚠️ **Manual Test Guidance**: Provides instructions for browser-based testing
- 🔄 **Build Integration**: Automatically runs during build process

## Test Reports

Test results are saved to `tests/test-report.json` with the following structure:

```json
{
  "timestamp": "2025-07-26T22:14:39.702Z",
  "duration": "12ms",
  "results": {
    "passed": 11,
    "failed": 0,
    "total": 11
  },
  "categories": ["Core Functionality", "Visual Features", "Verification", "Integration"],
  "recommendations": ["All tests passed structural validation..."]
}
```

## Adding New Tests

To add a new test file:

1. Create the HTML test file in the appropriate category
2. Update `test-runner.js` to include the new file in the relevant category
3. Ensure the test file references the main application using `../index.html`
4. Add appropriate test instructions and validation logic

## Regression Testing

The test suite automatically runs during builds via the `prebuild` npm script, ensuring:

- No structural regressions in test files
- All test files remain accessible and valid
- Manual testing guidance is provided for interactive features
- Build process fails if critical tests fail

## Manual Verification Checklist

When running manual tests, verify:

- [ ] All mathematical terms are clickable
- [ ] IBM color scheme is applied correctly based on nesting
- [ ] Hover effects and animations work properly
- [ ] Zoom functionality operates smoothly
- [ ] Term details display correctly when clicked
- [ ] Reset functionality clears all states
- [ ] Responsive design works on different screen sizes

## Troubleshooting

### Common Issues

1. **Test files not opening main application**
   - Ensure relative paths use `../index.html`
   - Check that main `index.html` exists in project root

2. **Test runner fails**
   - Verify Node.js is installed
   - Check that all test files have valid HTML structure

3. **Build process issues**
   - Tests run before build - fix any test failures first
   - Check npm scripts in `package.json` are configured correctly

### Getting Help

- Check the test report in `tests/test-report.json` for detailed results
- Run individual test files in browser for manual debugging
- Use browser developer tools to inspect console output during testing