    // Comprehensive equation data structure

    // Variables for equation functionality - now using XML as primary source
    let equationsData = {};
    let contentEquationsData = {};

    // Function to load equations from equations-content.xml for both areas
    async function loadEquationsContent() {
        try {
            console.log('Starting to load equations from XML...');
            const response = await fetch('equations-content.xml');

            if (!response.ok) {
                throw new Error(`Failed to fetch equations-content.xml: ${response.status} ${response.statusText}`);
            }

            const xmlText = await response.text();
            console.log('XML text loaded, length:', xmlText.length);

            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

            // Check for XML parsing errors
            const parseError = xmlDoc.querySelector('parsererror');
            if (parseError) {
                throw new Error('XML parsing error: ' + parseError.textContent);
            }

            const equations = xmlDoc.querySelectorAll('equation');
            console.log('Found', equations.length, 'equations in XML');

            const mainSelector = document.getElementById('equation-select');
            const contentSelector = document.getElementById('content-equation-select');

            if (!mainSelector) {
                throw new Error('Main equation selector not found in DOM');
            }
            if (!contentSelector) {
                throw new Error('Content equation selector not found in DOM');
            }

            // Clear existing options (except the first one for content selector)
            mainSelector.innerHTML = '';

            equations.forEach((equation, index) => {
                console.log(`Processing equation ${index + 1}:`, equation.getAttribute('id'));
                const id = equation.getAttribute('id');
                const title = equation.querySelector('title').textContent;
                const subtitle = equation.querySelector('subtitle').textContent;
                const contentMath = equation.querySelector('content m\\:math, content math');

                // Extract term information from XML
                const terms = equation.querySelectorAll('term');
                const termInfo = {};
                terms.forEach(term => {
                    const termId = term.getAttribute('id');
                    const termTitle = term.getAttribute('title');
                    const termDescription = term.getAttribute('description');
                    termInfo[termId] = {
                        title: termTitle,
                        description: termDescription
                    };
                });

                // Convert Content MathML to Presentation MathML with clickable terms
                console.log(`Converting MathML for equation ${id}...`);
                const presentationMath = convertContentToPresentationWithClickableTerms(contentMath, termInfo);
                console.log(`Conversion result for ${id}:`, presentationMath ? 'success' : 'failed');

                // Store equation data for main area
                equationsData[id] = {
                    title: title,
                    subtitle: `"${subtitle}"`,
                    explanation: {
                        title: `About ${title}`,
                        content: `This equation represents ${title.toLowerCase()}.`
                    },
                    mathml: presentationMath ? presentationMath.outerHTML : '',
                    termInfo: termInfo
                };
                console.log(`Stored equation data for ${id}`);

                // Store equation data for content area (existing functionality)
                contentEquationsData[id] = {
                    id: id,
                    title: title,
                    subtitle: subtitle,
                    contentMath: contentMath
                };

                // Add option to main selector
                const mainOption = document.createElement('option');
                mainOption.value = id;
                mainOption.textContent = title;
                mainSelector.appendChild(mainOption);
                console.log(`Added option to main selector: ${title}`);

                // Add option to content selector
                const contentOption = document.createElement('option');
                contentOption.value = id;
                contentOption.textContent = title;
                contentSelector.appendChild(contentOption);
                console.log(`Added option to content selector: ${title}`);
            });

            console.log(`Finished processing all equations. Main selector has ${mainSelector.options.length} options, content selector has ${contentSelector.options.length} options`);

            // Set the first equation as default
            const firstEquationId = Object.keys(equationsData)[0];
            console.log('First equation ID:', firstEquationId);

            if (firstEquationId) {
                currentEquation = firstEquationId;
                mainSelector.value = firstEquationId;
                console.log('Set main selector value to:', firstEquationId);

                // Update the display with the first equation
                console.log('Updating display with first equation...');
                document.getElementById('equation-title').textContent = equationsData[firstEquationId].title;
                document.getElementById('equation-subtitle').textContent = equationsData[firstEquationId].subtitle;
                document.querySelector('.euler-identity').innerHTML = equationsData[firstEquationId].mathml;
                document.getElementById('explanation-title').textContent = equationsData[firstEquationId].explanation.title;
                document.getElementById('explanation-content').innerHTML = equationsData[firstEquationId].explanation.content;
                console.log('Display updated successfully');

                // Attach click listeners after a short delay
                setTimeout(() => {
                    console.log('Attaching click listeners...');
                    attachClickListeners();
                }, 100);
            } else {
                console.error('No equations found in equationsData');
            }

            console.log('Loaded equations from content file:', Object.keys(equationsData));
        } catch (error) {
            console.error('Error loading equations-content.xml:', error);

            // Update main loading state
            document.getElementById('equation-title').textContent = 'Error Loading Equations';
            document.getElementById('equation-subtitle').textContent = 'Failed to load equations from XML file';
            document.querySelector('.euler-identity').innerHTML =
                '<p style="color: red; text-align: center;">Error loading equations-content.xml: ' + error.message + '</p>';

            // Update content area
            document.getElementById('content-equation-display').innerHTML =
                '<p style="color: red;">Error loading equations-content.xml file: ' + error.message + '</p>';

            // Ensure dropdowns show error state
            const mainSelector = document.getElementById('equation-select');
            const contentSelector = document.getElementById('content-equation-select');

            mainSelector.innerHTML = '<option value="">Error loading equations</option>';
            contentSelector.innerHTML = '<option value="">Error loading equations</option>';
        }
    }

    // Function to convert MathML content to presentation format with clickable terms
    function convertContentToPresentationWithClickableTerms(contentMath, termInfo) {
        if (!contentMath) return null;

        // Create a new math element for presentation
        const presentationMath = document.createElement('math');
        presentationMath.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
        presentationMath.setAttribute('display', 'block');
        presentationMath.style.fontSize = '2.5em';
        presentationMath.classList.add('tex2jax_ignore');

        // Convert the content MathML to presentation MathML with clickable terms
        const convertedContent = convertMathMLNodeWithClickableTerms(contentMath.firstElementChild, termInfo);
        if (convertedContent) {
            presentationMath.appendChild(convertedContent);
        }

        return presentationMath;
    }

    // Function to convert MathML content to presentation format (existing functionality)
    function convertContentToPresentation(contentMath) {
        if (!contentMath) return null;

        // Create a new math element for presentation
        const presentationMath = document.createElement('math');
        presentationMath.setAttribute('xmlns', 'http://www.w3.org/1998/Math/MathML');
        presentationMath.setAttribute('display', 'block');
        presentationMath.style.fontSize = '1.8em';

        // Convert the content MathML to presentation MathML
        const convertedContent = convertMathMLNode(contentMath.firstElementChild);
        if (convertedContent) {
            presentationMath.appendChild(convertedContent);
        }

        return presentationMath;
    }

    // Recursive function to convert MathML content nodes to presentation nodes with clickable terms
    function convertMathMLNodeWithClickableTerms(node, termInfo, termCounter = {count: 0}) {
        if (!node) return null;

        const nodeName = node.localName || node.nodeName.replace('m:', '');

        switch (nodeName) {
            case 'apply':
                return convertApplyWithClickableTerms(node, termInfo, termCounter);
            case 'ci':
                const mi = document.createElement('mi');
                mi.textContent = node.textContent;
                addClickableAttributes(mi, node.textContent, termInfo, termCounter);
                return mi;
            case 'cn':
                const mn = document.createElement('mn');
                mn.textContent = node.textContent;
                addClickableAttributes(mn, node.textContent, termInfo, termCounter);
                return mn;
            case 'pi':
                const pi = document.createElement('mi');
                pi.textContent = 'π';
                addClickableAttributes(pi, 'pi', termInfo, termCounter);
                return pi;
            case 'exponentiale':
                const e = document.createElement('mi');
                e.textContent = 'e';
                addClickableAttributes(e, 'e', termInfo, termCounter);
                return e;
            case 'imaginaryi':
                const i = document.createElement('mi');
                i.textContent = 'i';
                addClickableAttributes(i, 'i', termInfo, termCounter);
                return i;
            case 'infinity':
                const inf = document.createElement('mi');
                inf.textContent = '∞';
                addClickableAttributes(inf, 'infinity', termInfo, termCounter);
                return inf;
            default:
                // For other elements, try to convert children
                const element = document.createElement('mrow');
                Array.from(node.children).forEach(child => {
                    const converted = convertMathMLNodeWithClickableTerms(child, termInfo, termCounter);
                    if (converted) element.appendChild(converted);
                });
                return element.children.length > 0 ? element : null;
        }
    }

    // Helper function to add clickable attributes to elements
    function addClickableAttributes(element, termKey, termInfo, termCounter) {
        // Try to find matching term info
        let matchingTermId = null;

        // Direct match
        if (termInfo[termKey]) {
            matchingTermId = termKey;
        } else {
            // Try to find by content or common mappings
            const contentText = element.textContent.toLowerCase();
            for (const [id, info] of Object.entries(termInfo)) {
                if (id.toLowerCase().includes(contentText) ||
                    info.title.toLowerCase().includes(contentText) ||
                    (contentText === 'π' && id === 'pi') ||
                    (contentText === 'σ' && id === 'sigma') ||
                    (contentText === 'μ' && id === 'mu') ||
                    (contentText === '=' && id === 'equals') ||
                    (contentText === '+' && id === 'plus') ||
                    (contentText === '−' && id === 'minus') ||
                    (contentText === '1' && id === 'one') ||
                    (contentText === '2' && id === 'two') ||
                    (contentText === '0' && id === 'zero')) {
                    matchingTermId = id;
                    break;
                }
            }
        }

        if (matchingTermId) {
            element.classList.add('clickable-term');
            element.setAttribute('data-term', matchingTermId);
            element.setAttribute('id', `term-${matchingTermId}-${termCounter.count++}`);
        }
    }

    // Recursive function to convert MathML content nodes to presentation nodes (existing functionality)
    function convertMathMLNode(node) {
        if (!node) return null;

        const nodeName = node.localName || node.nodeName.replace('m:', '');

        switch (nodeName) {
            case 'apply':
                return convertApply(node);
            case 'ci':
                const mi = document.createElement('mi');
                mi.textContent = node.textContent;
                return mi;
            case 'cn':
                const mn = document.createElement('mn');
                mn.textContent = node.textContent;
                return mn;
            case 'pi':
                const pi = document.createElement('mi');
                pi.textContent = 'π';
                return pi;
            case 'exponentiale':
                const e = document.createElement('mi');
                e.textContent = 'e';
                return e;
            case 'imaginaryi':
                const i = document.createElement('mi');
                i.textContent = 'i';
                return i;
            case 'infinity':
                const inf = document.createElement('mi');
                inf.textContent = '∞';
                return inf;
            default:
                // For other elements, try to convert children
                const element = document.createElement('mrow');
                Array.from(node.children).forEach(child => {
                    const converted = convertMathMLNode(child);
                    if (converted) element.appendChild(converted);
                });
                return element.children.length > 0 ? element : null;
        }
    }

    // Function to convert apply elements (operations) with clickable terms
    function convertApplyWithClickableTerms(applyNode, termInfo, termCounter) {
        const children = Array.from(applyNode.children);
        if (children.length === 0) return null;

        const operator = children[0];
        const operands = children.slice(1);
        const opName = operator.localName || operator.nodeName.replace('m:', '');

        switch (opName) {
            case 'eq':
                const eqRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        const equals = document.createElement('mo');
                        equals.textContent = '=';
                        addClickableAttributes(equals, 'equals', termInfo, termCounter);
                        eqRow.appendChild(equals);
                    }
                    const converted = convertMathMLNodeWithClickableTerms(operand, termInfo, termCounter);
                    if (converted) eqRow.appendChild(converted);
                });
                return eqRow;

            case 'plus':
                const plusRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        const plus = document.createElement('mo');
                        plus.textContent = '+';
                        addClickableAttributes(plus, 'plus', termInfo, termCounter);
                        plusRow.appendChild(plus);
                    }
                    const converted = convertMathMLNodeWithClickableTerms(operand, termInfo, termCounter);
                    if (converted) plusRow.appendChild(converted);
                });
                return plusRow;

            case 'minus':
                if (operands.length === 1) {
                    // Unary minus
                    const minusRow = document.createElement('mrow');
                    const minus = document.createElement('mo');
                    minus.textContent = '−';
                    addClickableAttributes(minus, 'minus', termInfo, termCounter);
                    minusRow.appendChild(minus);
                    const converted = convertMathMLNodeWithClickableTerms(operands[0], termInfo, termCounter);
                    if (converted) minusRow.appendChild(converted);
                    return minusRow;
                } else {
                    // Binary minus
                    const minusRow = document.createElement('mrow');
                    operands.forEach((operand, index) => {
                        if (index > 0) {
                            const minus = document.createElement('mo');
                            minus.textContent = '−';
                            addClickableAttributes(minus, 'minus', termInfo, termCounter);
                            minusRow.appendChild(minus);
                        }
                        const converted = convertMathMLNodeWithClickableTerms(operand, termInfo, termCounter);
                        if (converted) minusRow.appendChild(converted);
                    });
                    return minusRow;
                }

            case 'times':
                const timesRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        // Usually implicit multiplication in presentation
                    }
                    const converted = convertMathMLNodeWithClickableTerms(operand, termInfo, termCounter);
                    if (converted) timesRow.appendChild(converted);
                });
                return timesRow;

            case 'divide':
                const frac = document.createElement('mfrac');
                addClickableAttributes(frac, 'fraction', termInfo, termCounter);
                if (operands.length >= 2) {
                    const num = convertMathMLNodeWithClickableTerms(operands[0], termInfo, termCounter);
                    const den = convertMathMLNodeWithClickableTerms(operands[1], termInfo, termCounter);
                    if (num) frac.appendChild(num);
                    if (den) frac.appendChild(den);
                }
                return frac;

            case 'power':
                const sup = document.createElement('msup');
                addClickableAttributes(sup, 'exponential', termInfo, termCounter);
                if (operands.length >= 2) {
                    const base = convertMathMLNodeWithClickableTerms(operands[0], termInfo, termCounter);
                    const exp = convertMathMLNodeWithClickableTerms(operands[1], termInfo, termCounter);
                    if (base) sup.appendChild(base);
                    if (exp) sup.appendChild(exp);
                }
                return sup;

            case 'root':
                const sqrt = document.createElement('msqrt');
                addClickableAttributes(sqrt, 'sqrt', termInfo, termCounter);
                if (operands.length >= 1) {
                    const radicand = convertMathMLNodeWithClickableTerms(operands[0], termInfo, termCounter);
                    if (radicand) sqrt.appendChild(radicand);
                }
                return sqrt;

            case 'int':
                // Handle integrals
                const intRow = document.createElement('mrow');
                const intSymbol = document.createElement('mo');
                intSymbol.textContent = '∫';
                addClickableAttributes(intSymbol, 'integral', termInfo, termCounter);
                intRow.appendChild(intSymbol);

                // Add limits and integrand with clickable terms
                const bvar = applyNode.querySelector('bvar');
                const lowlimit = applyNode.querySelector('lowlimit');
                const uplimit = applyNode.querySelector('uplimit');

                if (lowlimit || uplimit) {
                    const subsup = document.createElement('msubsup');
                    subsup.appendChild(intSymbol.cloneNode(true));

                    if (lowlimit) {
                        const lowConverted = convertMathMLNodeWithClickableTerms(lowlimit.firstElementChild, termInfo, termCounter);
                        if (lowConverted) subsup.appendChild(lowConverted);
                    } else {
                        subsup.appendChild(document.createElement('mrow'));
                    }

                    if (uplimit) {
                        const upConverted = convertMathMLNodeWithClickableTerms(uplimit.firstElementChild, termInfo, termCounter);
                        if (upConverted) subsup.appendChild(upConverted);
                    }

                    intRow.innerHTML = '';
                    intRow.appendChild(subsup);
                }

                // Add integrand
                const integrand = operands.find(op => !op.matches('bvar, lowlimit, uplimit'));
                if (integrand) {
                    const integrandConverted = convertMathMLNodeWithClickableTerms(integrand, termInfo, termCounter);
                    if (integrandConverted) intRow.appendChild(integrandConverted);
                }

                // Add differential
                if (bvar) {
                    const d = document.createElement('mi');
                    d.textContent = 'd';
                    addClickableAttributes(d, 'dt', termInfo, termCounter);
                    intRow.appendChild(d);

                    const varConverted = convertMathMLNodeWithClickableTerms(bvar.firstElementChild, termInfo, termCounter);
                    if (varConverted) intRow.appendChild(varConverted);
                }

                return intRow;

            default:
                // For unknown operations, create a generic row
                const genericRow = document.createElement('mrow');
                operands.forEach(operand => {
                    const converted = convertMathMLNodeWithClickableTerms(operand, termInfo, termCounter);
                    if (converted) genericRow.appendChild(converted);
                });
                return genericRow.children.length > 0 ? genericRow : null;
        }
    }

    // Function to convert apply elements (operations) - existing functionality
    function convertApply(applyNode) {
        const children = Array.from(applyNode.children);
        if (children.length === 0) return null;

        const operator = children[0];
        const operands = children.slice(1);
        const opName = operator.localName || operator.nodeName.replace('m:', '');

        switch (opName) {
            case 'eq':
                const eqRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        const equals = document.createElement('mo');
                        equals.textContent = '=';
                        eqRow.appendChild(equals);
                    }
                    const converted = convertMathMLNode(operand);
                    if (converted) eqRow.appendChild(converted);
                });
                return eqRow;

            case 'plus':
                const plusRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        const plus = document.createElement('mo');
                        plus.textContent = '+';
                        plusRow.appendChild(plus);
                    }
                    const converted = convertMathMLNode(operand);
                    if (converted) plusRow.appendChild(converted);
                });
                return plusRow;

            case 'minus':
                if (operands.length === 1) {
                    // Unary minus
                    const minusRow = document.createElement('mrow');
                    const minus = document.createElement('mo');
                    minus.textContent = '−';
                    minusRow.appendChild(minus);
                    const converted = convertMathMLNode(operands[0]);
                    if (converted) minusRow.appendChild(converted);
                    return minusRow;
                } else {
                    // Binary minus
                    const minusRow = document.createElement('mrow');
                    operands.forEach((operand, index) => {
                        if (index > 0) {
                            const minus = document.createElement('mo');
                            minus.textContent = '−';
                            minusRow.appendChild(minus);
                        }
                        const converted = convertMathMLNode(operand);
                        if (converted) minusRow.appendChild(converted);
                    });
                    return minusRow;
                }

            case 'times':
                const timesRow = document.createElement('mrow');
                operands.forEach((operand, index) => {
                    if (index > 0) {
                        // Usually implicit multiplication in presentation
                    }
                    const converted = convertMathMLNode(operand);
                    if (converted) timesRow.appendChild(converted);
                });
                return timesRow;

            case 'divide':
                const frac = document.createElement('mfrac');
                if (operands.length >= 2) {
                    const num = convertMathMLNode(operands[0]);
                    const den = convertMathMLNode(operands[1]);
                    if (num) frac.appendChild(num);
                    if (den) frac.appendChild(den);
                }
                return frac;

            case 'power':
                const sup = document.createElement('msup');
                if (operands.length >= 2) {
                    const base = convertMathMLNode(operands[0]);
                    const exp = convertMathMLNode(operands[1]);
                    if (base) sup.appendChild(base);
                    if (exp) sup.appendChild(exp);
                }
                return sup;

            case 'root':
                const sqrt = document.createElement('msqrt');
                if (operands.length >= 1) {
                    const radicand = convertMathMLNode(operands[0]);
                    if (radicand) sqrt.appendChild(radicand);
                }
                return sqrt;

            case 'int':
                // Handle integrals
                const intRow = document.createElement('mrow');
                const intSymbol = document.createElement('mo');
                intSymbol.textContent = '∫';
                intRow.appendChild(intSymbol);

                // Add limits if present
                const bvar = applyNode.querySelector('bvar');
                const lowlimit = applyNode.querySelector('lowlimit');
                const uplimit = applyNode.querySelector('uplimit');

                if (lowlimit || uplimit) {
                    const subsup = document.createElement('msubsup');
                    subsup.appendChild(intSymbol.cloneNode(true));

                    if (lowlimit) {
                        const lowConverted = convertMathMLNode(lowlimit.firstElementChild);
                        subsup.appendChild(lowConverted || document.createElement('mrow'));
                    } else {
                        subsup.appendChild(document.createElement('mrow'));
                    }

                    if (uplimit) {
                        const upConverted = convertMathMLNode(uplimit.firstElementChild);
                        subsup.appendChild(upConverted || document.createElement('mrow'));
                    } else {
                        subsup.appendChild(document.createElement('mrow'));
                    }

                    intRow.removeChild(intSymbol);
                    intRow.appendChild(subsup);
                }

                // Add integrand
                const integrand = operands[operands.length - 1];
                if (integrand) {
                    const converted = convertMathMLNode(integrand);
                    if (converted) intRow.appendChild(converted);
                }

                // Add differential
                if (bvar) {
                    const d = document.createElement('mi');
                    d.textContent = 'd';
                    intRow.appendChild(d);
                    const varConverted = convertMathMLNode(bvar.firstElementChild);
                    if (varConverted) intRow.appendChild(varConverted);
                }

                return intRow;

            default:
                // For unknown operations, create a function application
                const funcRow = document.createElement('mrow');
                const funcName = document.createElement('mi');
                funcName.textContent = opName;
                funcRow.appendChild(funcName);

                const lparen = document.createElement('mo');
                lparen.textContent = '(';
                funcRow.appendChild(lparen);

                operands.forEach((operand, index) => {
                    if (index > 0) {
                        const comma = document.createElement('mo');
                        comma.textContent = ',';
                        funcRow.appendChild(comma);
                    }
                    const converted = convertMathMLNode(operand);
                    if (converted) funcRow.appendChild(converted);
                });

                const rparen = document.createElement('mo');
                rparen.textContent = ')';
                funcRow.appendChild(rparen);

                return funcRow;
        }
    }

    // Function to load and display selected content equation
    function loadContentEquation() {
        const selector = document.getElementById('content-equation-select');
        const selectedId = selector.value;

        if (!selectedId) {
            document.getElementById('content-equation-display').innerHTML =
                '<p style="color: #999;">Select an equation to see the MathML content converted to presentation format.</p>';
            document.getElementById('content-equation-info').style.display = 'none';
            return;
        }

        const equationData = contentEquationsData[selectedId];
        if (!equationData) {
            console.error('No data found for equation:', selectedId);
            return;
        }

        // Update equation info
        document.getElementById('content-equation-title').textContent = equationData.title;
        document.getElementById('content-equation-subtitle').textContent = equationData.subtitle;
        document.getElementById('content-equation-info').style.display = 'block';

        // Convert and display equation
        const presentationMath = convertContentToPresentation(equationData.contentMath);
        const displayArea = document.getElementById('content-equation-display');

        if (presentationMath) {
            displayArea.innerHTML = '';
            displayArea.appendChild(presentationMath);

            // Re-render with MathJax if available
            if (window.MathJax && window.MathJax.typesetPromise) {
                window.MathJax.typesetPromise([displayArea]).catch(err => {
                    console.error('MathJax rendering error:', err);
                });
            }
        } else {
            displayArea.innerHTML = '<p style="color: red;">Error converting equation to presentation format.</p>';
        }
    }

    // Current equation tracker
    let currentEquation = 'euler';

    // IBM Carbon Design System color palette (6 colors)
    const IBM_COLORS = 6;

    // Function to calculate nesting level of an element
    function calculateNestingLevel(element) {
        // Special case: 'e' should be treated as a base level term (blue)
        if (element.id === 'term-e') {
            return 0;
        }
            
        let level = 0;
        let parent = element.parentElement;
            
        // Traverse up the DOM tree to determine proper nesting level
        while (parent && parent !== document.body) {
            if (parent.classList && parent.classList.contains('clickable-term')) {
                // Check if this parent is a mathematical operation container
                const parentTerm = parent.dataset.term;
                    
                // Operations like division, plus, exponential, etc. create nesting
                // The operation itself is at base level, its arguments are nested 1 deeper
                if (parentTerm === 'fraction' || parentTerm === 'plus' || parentTerm === 'minus' || 
                    parentTerm === 'exponential' || parentTerm === 'sqrt' || parentTerm === 'equals') {
                    level++;
                }
                // For other clickable terms, also increment level
                else {
                    level++;
                }
            }
            parent = parent.parentElement;
        }
            
        return level;
    }

    // Function to apply IBM color based on nesting level
    function applyNestingColor(element, nestingLevel) {
        // Remove any existing nesting level classes
        for (let i = 0; i < IBM_COLORS; i++) {
            element.classList.remove(`nesting-level-${i}`);
        }

        // Apply the appropriate nesting level class (with cycling)
        const colorLevel = nestingLevel % IBM_COLORS;
        element.classList.add(`nesting-level-${colorLevel}`);

        console.log(`Applied nesting-level-${colorLevel} to element:`, element.textContent, `(actual nesting: ${nestingLevel})`);
    }

    // Function to add click event listeners to all clickable MathML terms
    function attachClickListeners() {
        const clickableElements = document.querySelectorAll('.clickable-term');
        console.log('Found', clickableElements.length, 'clickable elements');

        clickableElements.forEach((element, index) => {
            console.log(`Element ${index}:`, element.tagName, element.textContent, element.dataset.term);

            // Calculate and apply nesting level color
            const nestingLevel = calculateNestingLevel(element);
            applyNestingColor(element, nestingLevel);

            element.addEventListener('click', function(event) {
                console.log('Click detected on:', this.textContent, 'term:', this.dataset.term);

                // Prevent event bubbling for nested elements
                event.stopPropagation();

                const term = this.dataset.term;
                if (term) {
                    console.log('Showing details for term:', term);
                    showTermDetails(term);

                    // Add clicked animation
                    this.classList.add('clicked');
                    setTimeout(() => {
                        this.classList.remove('clicked');
                    }, 600);
                } else {
                    console.log('No term data found for element:', this);
                }
            });
        });

        if (clickableElements.length === 0) {
            console.error('No clickable elements found! Check if MathML is rendered correctly.');
        }
    }

    // Function to switch between equations
    function switchEquation() {
        const selectElement = document.getElementById('equation-select');
        const selectedEquation = selectElement.value;
        currentEquation = selectedEquation;

        const equationData = equationsData[selectedEquation];
        if (!equationData) {
            console.error('No data found for equation:', selectedEquation);
            return;
        }

        // Update title and subtitle
        document.getElementById('equation-title').textContent = equationData.title;
        document.getElementById('equation-subtitle').textContent = equationData.subtitle;

        // Update equation display
        const equationContainer = document.querySelector('.euler-identity');
        equationContainer.innerHTML = equationData.mathml;

        // Update explanation
        document.getElementById('explanation-title').textContent = equationData.explanation.title;
        document.getElementById('explanation-content').innerHTML = equationData.explanation.content;

        // Reset term details
        resetTerms();

        // Process new MathML content with MathJax and then attach click listeners
        if (window.MathJax && window.MathJax.typesetPromise) {
            console.log('Processing MathML with MathJax for equation:', selectedEquation);
            window.MathJax.typesetPromise([equationContainer]).then(() => {
                console.log('MathJax processing complete for:', selectedEquation);
                // Attach click listeners after MathJax processing is complete
                setTimeout(() => {
                    attachClickListeners();
                }, 100);
            }).catch((err) => {
                console.error('MathJax processing error:', err);
                // Still try to attach click listeners even if MathJax fails
                setTimeout(() => {
                    attachClickListeners();
                }, 100);
            });
        } else {
            console.warn('MathJax not available, attaching click listeners without processing');
            // Fallback: attach click listeners without MathJax processing
            setTimeout(() => {
                attachClickListeners();
            }, 100);
        }

        console.log('Switched to equation:', selectedEquation);
    }

    function showTermDetails(term) {
        console.log('showTermDetails called with term:', term);

        const detailsDiv = document.getElementById('term-details');
        const titleElement = document.getElementById('term-title');
        const descriptionElement = document.getElementById('term-description');

        console.log('Elements found:', {
            detailsDiv: !!detailsDiv,
            titleElement: !!titleElement,
            descriptionElement: !!descriptionElement
        });

        // Use current equation's termInfo
        const currentTermInfo = equationsData[currentEquation].termInfo;

        if (currentTermInfo[term]) {
            console.log('Term info found:', currentTermInfo[term]);
            titleElement.textContent = currentTermInfo[term].title;
            descriptionElement.textContent = currentTermInfo[term].description;
            detailsDiv.classList.add('show');
            console.log('Term details displayed successfully');
        } else {
            console.error('No term info found for:', term);
            console.log('Available terms:', Object.keys(currentTermInfo));
        }
    }

    function resetTerms() {
        const detailsDiv = document.getElementById('term-details');
        detailsDiv.classList.remove('show');

        // Remove any clicked states from MathML elements
        document.querySelectorAll('.clickable-term').forEach(element => {
            element.classList.remove('clicked');
        });
    }

    // Zoom functionality
    let currentZoom = 1.0;
    const minZoom = 0.5;
    const maxZoom = 3.0;
    const zoomStep = 0.25;

    function updateZoomDisplay() {
        const zoomPercentage = Math.round(currentZoom * 100);
        document.getElementById('zoom-level').textContent = zoomPercentage + '%';

        // Update button states
        const zoomInBtn = document.getElementById('zoom-in');
        const zoomOutBtn = document.getElementById('zoom-out');

        zoomInBtn.disabled = currentZoom >= maxZoom;
        zoomOutBtn.disabled = currentZoom <= minZoom;
    }

    function applyZoom() {
        const equationContainer = document.getElementById('equation-container');
        equationContainer.style.transform = `scale(${currentZoom})`;
        updateZoomDisplay();
    }

    function zoomIn() {
        if (currentZoom < maxZoom) {
            currentZoom = Math.min(currentZoom + zoomStep, maxZoom);
            applyZoom();
        }
    }

    function zoomOut() {
        if (currentZoom > minZoom) {
            currentZoom = Math.max(currentZoom - zoomStep, minZoom);
            applyZoom();
        }
    }

    function resetZoom() {
        currentZoom = 1.0;
        applyZoom();
    }

    // Initialize when DOM is ready
    document.addEventListener('DOMContentLoaded', function() {
        console.log('DOM loaded, initializing application');
        // Initialize zoom display
        updateZoomDisplay();
        // Load equations from content file (this will also attach click listeners when done)
        loadEquationsContent();
    });

    // Also attach on window load as a fallback
    window.addEventListener('load', function() {
        console.log('Window loaded, ensuring click listeners are attached');
        // Only attach if not already attached
        if (document.querySelectorAll('.clickable-term').length > 0) {
            attachClickListeners();
        }
    });
