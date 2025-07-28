// EquationAce - Mathematical Expression Editor
// MathJax types are provided by @types/mathjax package

// Interface for expression transformations
interface Transformation {
    section: string;
    replacements: string[];
}

interface TransformationResponse {
    transformations: Transformation[];
}

// Interface for selectable expression parts
interface SelectableExpression {
    expression: string;
    startIndex: number;
    endIndex: number;
    type?: string;
    element?: HTMLElement;
}

class EquationEditor {
    private expressionInput: HTMLInputElement;
    private mathDisplay: HTMLElement;
    private renderedMath: HTMLElement;
    private presetSelect: HTMLSelectElement;
    private selectedExpressionSpan: HTMLElement;
    private getTransformationsBtn: HTMLButtonElement;
    private transformationsPanel: HTMLElement;
    private transformationsList: HTMLElement;
    private virtualKeyboard: HTMLElement;
    private debugPanel: HTMLElement;
    
    // New term editor elements
    private editTermBtn: HTMLButtonElement;
    private termEditorModal: HTMLElement;
    private termEditorInput: HTMLTextAreaElement;
    private termPreviewDisplay: HTMLElement;
    private closeTermEditorBtn: HTMLButtonElement;
    private cancelTermEditBtn: HTMLButtonElement;
    private applyTermEditBtn: HTMLButtonElement;
    private functionArgsSection: HTMLElement;
    private argsContainer: HTMLElement;
    
    private currentExpression: string = '';
    private selectedExpression: SelectableExpression | null = null;
    private selectableExpressions: SelectableExpression[] = [];
    private originalTermValue: string = ''; // Store original value for cancel functionality

    constructor() {
        // Check if MathJax is available
        if (typeof MathJax === 'undefined') {
            console.error('❌ MathJax library not found! Make sure MathJax is loaded before this script.');
            alert('Error: MathJax library not found. Please refresh the page.');
            return;
        }
        
        this.initializeElements();
        this.createDebugPanel();
        this.addDebugMessage('✅ MathJax library found and ready');
        this.setupEventListeners();
        this.setupVirtualKeyboard();
        this.setupPresetEquations();
    }

    private initializeElements(): void {
        // Original elements
        this.expressionInput = document.getElementById('expression-input') as HTMLInputElement;
        this.mathDisplay = document.getElementById('math-display') as HTMLElement;
        this.renderedMath = document.getElementById('rendered-math') as HTMLElement;
        this.presetSelect = document.getElementById('preset-select') as HTMLSelectElement;
        this.selectedExpressionSpan = document.getElementById('selected-expression') as HTMLElement;
        this.getTransformationsBtn = document.getElementById('get-transformations') as HTMLButtonElement;
        this.transformationsPanel = document.getElementById('transformations-panel') as HTMLElement;
        this.transformationsList = document.getElementById('transformations-list') as HTMLElement;
        this.virtualKeyboard = document.getElementById('virtual-keyboard') as HTMLElement;
        
        // New term editor elements
        this.editTermBtn = document.getElementById('edit-term-btn') as HTMLButtonElement;
        this.termEditorModal = document.getElementById('term-editor-modal') as HTMLElement;
        this.termEditorInput = document.getElementById('term-editor-input') as HTMLTextAreaElement;
        this.termPreviewDisplay = document.getElementById('term-preview-display') as HTMLElement;
        this.closeTermEditorBtn = document.getElementById('close-term-editor') as HTMLButtonElement;
        this.cancelTermEditBtn = document.getElementById('cancel-term-edit') as HTMLButtonElement;
        this.applyTermEditBtn = document.getElementById('apply-term-edit') as HTMLButtonElement;
        this.functionArgsSection = document.getElementById('function-args') as HTMLElement;
        this.argsContainer = document.getElementById('args-container') as HTMLElement;
    }

    private createDebugPanel(): void {
        // Create debug panel HTML structure
        this.debugPanel = document.createElement('div');
        this.debugPanel.id = 'debug-panel';
        this.debugPanel.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #fff;
            border: 2px solid #ff6b6b;
            border-radius: 8px;
            padding: 15px;
            max-width: 350px;
            max-height: 400px;
            overflow-y: auto;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            z-index: 1000;
            font-family: monospace;
            font-size: 12px;
        `;
        
        this.debugPanel.innerHTML = `
            <h3 style="margin: 0 0 10px 0; color: #ff6b6b;">🔍 Debug Panel</h3>
            <div id="debug-log" style="max-height: 300px; overflow-y: auto;"></div>
            <button onclick="document.getElementById('debug-log').innerHTML = ''" 
                    style="margin-top: 10px; padding: 5px 10px; background: #ff6b6b; color: white; border: none; border-radius: 4px; cursor: pointer;">
                Clear Log
            </button>
        `;
        
        document.body.appendChild(this.debugPanel);
        this.addDebugMessage('🚀 Debug panel initialized');
    }

    private addDebugMessage(message: string): void {
        const debugLog = document.getElementById('debug-log');
        if (debugLog) {
            const timestamp = new Date().toLocaleTimeString();
            const logEntry = document.createElement('div');
            logEntry.style.cssText = 'margin: 2px 0; padding: 2px; border-bottom: 1px solid #eee;';
            logEntry.innerHTML = `<span style="color: #666;">[${timestamp}]</span> ${message}`;
            debugLog.appendChild(logEntry);
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    }

    private setupEventListeners(): void {
        // Math display click events (primary interaction)
        this.mathDisplay.addEventListener('click', (e) => this.handleMathClick(e));
        
        // Preset selection
        this.presetSelect.addEventListener('change', (e) => this.handlePresetSelection(e));
        
        // Transformations button
        this.getTransformationsBtn.addEventListener('click', () => this.getTransformations());
        
        // Term editor events
        this.editTermBtn.addEventListener('click', () => this.openTermEditor());
        this.closeTermEditorBtn.addEventListener('click', () => this.closeTermEditor());
        this.cancelTermEditBtn.addEventListener('click', () => this.cancelTermEdit());
        this.applyTermEditBtn.addEventListener('click', () => this.applyTermEdit());
        
        // Term editor input events
        this.termEditorInput.addEventListener('input', () => this.updateTermPreview());
        this.termEditorInput.addEventListener('keydown', (e) => this.handleTermEditorShortcuts(e));
        
        // Modal backdrop click to close
        this.termEditorModal.addEventListener('click', (e) => {
            if (e.target === this.termEditorModal) {
                this.closeTermEditor();
            }
        });
        
        // Escape key to close modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.termEditorModal.style.display !== 'none') {
                this.closeTermEditor();
            }
        });
    }

    private setupVirtualKeyboard(): void {
        const keys = this.virtualKeyboard.querySelectorAll('.key');
        keys.forEach(key => {
            key.addEventListener('click', (e) => this.handleVirtualKeyClick(e));
        });
    }

    private setupPresetEquations(): void {
        // Initialize with empty display
        this.renderExpression('');
    }


    private handleVirtualKeyClick(event: Event): void {
        console.log('🔍 DEBUG: Virtual key clicked!', event);
        this.addDebugMessage('🖱️ Virtual key clicked!');
        
        const button = event.target as HTMLButtonElement;
        console.log('🔍 DEBUG: Button element:', button);
        console.log('🔍 DEBUG: Button text content:', button.textContent);
        this.addDebugMessage(`📋 Button: "${button.textContent}"`);
        
        const expressionText = button.getAttribute('data-expression');
        const cursorPos = button.getAttribute('data-cursor-pos');
        
        console.log('🔍 DEBUG: Expression attribute:', expressionText);
        console.log('🔍 DEBUG: Cursor position attribute:', cursorPos);
        this.addDebugMessage(`🔤 Expression: "${expressionText}"`);
        this.addDebugMessage(`📍 Cursor pos: ${cursorPos}`);
        
        if (expressionText) {
            console.log('🔍 DEBUG: Calling insertExpression with:', expressionText, cursorPos ? parseInt(cursorPos) : null);
            this.addDebugMessage('➡️ Calling insertExpression...');
            this.insertExpression(expressionText, cursorPos ? parseInt(cursorPos) : null);
        } else {
            console.error('❌ DEBUG: No expression attribute found on button!');
            this.addDebugMessage('❌ No expression attribute found!');
        }
    }

    private insertExpression(expression: string, cursorOffset: number | null = null): void {
        console.log('🔍 DEBUG: insertExpression called with:', expression, cursorOffset);
        this.addDebugMessage(`🔧 insertExpression: "${expression}"`);
        
        // Check if term editor is open - if so, insert into term editor instead
        if (this.termEditorModal.style.display === 'flex') {
            this.insertIntoTermEditor(expression, cursorOffset);
            return;
        }
        
        // If no term is selected, create a new equation with this expression
        if (!this.selectedExpression) {
            this.currentExpression = expression;
            this.renderExpression(this.currentExpression);
            this.addDebugMessage(`✅ Created new equation: "${expression}"`);
            return;
        }
        
        // If a term is selected, replace it with the new expression
        const newExpression = this.currentExpression.replace(this.selectedExpression.expression, expression);
        this.currentExpression = newExpression;
        this.selectedExpression.expression = expression;
        this.expressionInput.value = expression;
        this.selectedExpressionSpan.textContent = expression;
        this.renderExpression(this.currentExpression);
        
        this.addDebugMessage(`✅ Replaced term: "${this.selectedExpression.expression}" → "${expression}"`);
    }

    private insertIntoTermEditor(expression: string, cursorOffset: number | null = null): void {
        const textarea = this.termEditorInput;
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const currentValue = textarea.value;
        
        const newValue = currentValue.substring(0, start) + expression + currentValue.substring(end);
        textarea.value = newValue;
        
        // Set cursor position
        let newCursorPos = start + expression.length;
        if (cursorOffset !== null) {
            newCursorPos = start + cursorOffset;
        }
        
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
        
        // Update the preview
        this.updateTermPreview();
        
        this.addDebugMessage(`✅ Inserted into term editor: "${expression}"`);
    }

    private handlePresetSelection(event: Event): void {
        const select = event.target as HTMLSelectElement;
        if (select.value) {
            this.currentExpression = select.value;
            this.renderExpression(this.currentExpression);
            this.clearSelection();
            this.addDebugMessage(`📋 Loaded preset equation: "${select.value}"`);
        }
    }

    private renderExpression(expression: string): void {
        console.log('🔍 DEBUG: renderExpression called with:', expression);
        console.log('🔍 DEBUG: renderedMath element:', this.renderedMath);
        console.log('🔍 DEBUG: renderedMath element exists:', !!this.renderedMath);
        this.addDebugMessage(`🎨 renderExpression: "${expression}"`);
        this.addDebugMessage(`🎯 renderedMath exists: ${!!this.renderedMath}`);
        
        try {
            if (expression.trim() === '') {
                console.log('🔍 DEBUG: Empty expression, showing placeholder');
                this.addDebugMessage('📝 Empty expression - showing placeholder');
                this.renderedMath.innerHTML = '<span style="color: #999; font-style: italic;">Enter a mathematical expression...</span>';
                this.selectableExpressions = [];
                return;
            }

            console.log('🔍 DEBUG: Calling MathJax tex2chtml with:', expression);
            this.addDebugMessage('🔧 Calling MathJax tex2chtml...');
            
            // Render with MathJax
            const mathElement = (MathJax as any).tex2chtml(expression, {
                display: false,
                em: 16,
                ex: 8,
                containerWidth: 1200
            });
            const rendered = mathElement.outerHTML;
            
            console.log('🔍 DEBUG: MathJax rendered result:', rendered);
            console.log('🔍 DEBUG: Setting renderedMath innerHTML...');
            this.addDebugMessage('✅ MathJax rendering successful');
            this.addDebugMessage('🖼️ Setting innerHTML...');
            
            // Generate selectable expressions first
            this.generateSelectableExpressions(expression);
            
            // TEMPORARY FIX: Disable createClickableEquation to prevent HTML corruption
            // The createClickableEquation method is causing issues with complex expressions like e^{i\pi}
            // TODO: Implement a proper solution for making equations clickable
            // const clickableRendered = this.createClickableEquation(expression, rendered);
            this.renderedMath.innerHTML = rendered;
            
            console.log('🔍 DEBUG: renderedMath innerHTML after setting:', this.renderedMath.innerHTML);
            this.addDebugMessage('✅ innerHTML set successfully');
            this.addDebugMessage('🔍 Generated clickable expressions');
            
            console.log('✅ DEBUG: renderExpression completed successfully');
            this.addDebugMessage('🎉 renderExpression completed!');
            
        } catch (error) {
            console.error('❌ DEBUG: Expression rendering error:', error);
            this.addDebugMessage(`❌ Rendering error: ${error}`);
            this.renderedMath.innerHTML = `<span style="color: #cc0000;">Error rendering: ${expression}</span>`;
        }
    }

    private createClickableEquation(expression: string, renderedHtml: string): string {
        // Create a clickable version of the equation by wrapping selectable terms
        let clickableHtml = renderedHtml;
        
        // Sort expressions by length (longest first) to avoid nested replacements
        const sortedExpressions = [...this.selectableExpressions].sort((a, b) => 
            (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex)
        );
        
        // For each selectable expression, we need to find corresponding rendered elements
        // This is a simplified approach - in a full implementation, you'd need proper MathJax-to-DOM mapping
        sortedExpressions.forEach((expr, index) => {
            const termId = `selectable-term-${index}`;
            const termClass = 'selectable-term';
            
            // Try to identify the rendered content for this MathJax expression
            // This is a basic approach that works for simple cases
            let searchPattern = this.createSearchPatternForExpression(expr.expression);
            
            if (searchPattern && clickableHtml.includes(searchPattern)) {
                const replacement = `<label class="${termClass}" data-term-id="${index}" data-expression="${expr.expression.replace(/"/g, '&quot;')}" style="cursor: pointer; border-radius: 4px; padding: 2px 4px; margin: 1px; transition: all 0.2s ease; display: inline-block; border: 1px solid #ddd; background-color: #f8f9fa; user-select: none;"><input type="checkbox" style="display: none;" data-term-id="${index}" data-expression="${expr.expression.replace(/"/g, '&quot;')}">${searchPattern}</label>`;
                clickableHtml = clickableHtml.replace(searchPattern, replacement);
            }
        });
        
        return clickableHtml;
    }

    private createSearchPatternForExpression(expression: string): string {
        // Convert expression to a pattern that might appear in rendered HTML
        // This is a simplified mapping - a full implementation would need comprehensive expression-to-HTML mapping
        let pattern = expression;
        
        // Handle common MathJax to HTML conversions
        pattern = pattern.replace(/\\sin/g, 'sin');
        pattern = pattern.replace(/\\cos/g, 'cos');
        pattern = pattern.replace(/\\tan/g, 'tan');
        pattern = pattern.replace(/\\log/g, 'log');
        pattern = pattern.replace(/\\ln/g, 'ln');
        pattern = pattern.replace(/\\pi/g, 'π');
        pattern = pattern.replace(/\\alpha/g, 'α');
        pattern = pattern.replace(/\\beta/g, 'β');
        pattern = pattern.replace(/\\gamma/g, 'γ');
        pattern = pattern.replace(/\\delta/g, 'δ');
        pattern = pattern.replace(/\\theta/g, 'θ');
        pattern = pattern.replace(/\\lambda/g, 'λ');
        pattern = pattern.replace(/\\mu/g, 'μ');
        pattern = pattern.replace(/\\sigma/g, 'σ');
        pattern = pattern.replace(/\\phi/g, 'φ');
        pattern = pattern.replace(/\\omega/g, 'ω');
        
        // Remove MathJax braces for simple cases
        pattern = pattern.replace(/\{([^}]*)\}/g, '$1');
        
        // Handle powers - MathJax ^{2} becomes superscript in HTML
        pattern = pattern.replace(/\^2/g, '²');
        pattern = pattern.replace(/\^3/g, '³');
        
        return pattern;
    }

    private generateSelectableExpressions(expression: string): void {
        // Enhanced approach to generate selectable expressions with automatic selection of function arguments and power expressions
        this.selectableExpressions = [];
        
        // Enhanced patterns that automatically select function arguments and power expressions
        const patterns = [
            // Complete functions with powers and arguments (e.g., \sin^2(x), \cos^2(x))
            { pattern: /\\(sin|cos|tan|log|ln)\^?\{?[0-9]*\}?\([^)]+\)/g, type: 'function_with_args' },
            // Complete functions with powers and braces (e.g., \sin^2{x})
            { pattern: /\\(sin|cos|tan|log|ln)\^\{[^}]+\}\{[^}]+\}/g, type: 'function_with_args' },
            // Complete functions with braces (e.g., \sin{x}, \cos{x})
            { pattern: /\\(sin|cos|tan|log|ln)\{[^}]+\}/g, type: 'function_with_args' },
            // Complete power expressions (base^exponent) - everything being raised to a power
            { pattern: /([a-zA-Z0-9\\{}()]+|\([^)]+\)|\{[^}]+\})\^\{[^}]+\}/g, type: 'power_expression' },
            // Simple power expressions with single characters
            { pattern: /[a-zA-Z0-9]\^[a-zA-Z0-9]/g, type: 'power_expression' },
            // Complete fractions
            { pattern: /\\frac\{[^}]+\}\{[^}]+\}/g, type: 'fraction' },
            // Complete square roots
            { pattern: /\\sqrt\{[^}]+\}/g, type: 'sqrt' },
            // Complete nth roots
            { pattern: /\\sqrt\[[^]]+\]\{[^}]+\}/g, type: 'nth_root' },
            // Subscripts with their base
            { pattern: /[a-zA-Z0-9]_\{[^}]+\}/g, type: 'subscript' },
            // Greek letters
            { pattern: /\\(alpha|beta|gamma|delta|pi|theta|lambda|mu|sigma|phi|omega)/g, type: 'greek_letter' },
            // Numbers (including decimals)
            { pattern: /\d+(\.\d+)?/g, type: 'number' },
            // Single variables
            { pattern: /[a-zA-Z]/g, type: 'variable' }
        ];

        patterns.forEach(({ pattern, type }) => {
            let match;
            while ((match = pattern.exec(expression)) !== null) {
                const expression = {
                    expression: match[0],
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    type: type
                };
                
                // Avoid duplicate expressions (prefer longer ones)
                const isDuplicate = this.selectableExpressions.some(existing => 
                    existing.startIndex <= expression.startIndex && 
                    existing.endIndex >= expression.endIndex &&
                    existing.expression.includes(expression.expression)
                );
                
                if (!isDuplicate) {
                    this.selectableExpressions.push(expression);
                }
            }
        });

        // Remove overlapping expressions, keeping the most comprehensive ones
        this.selectableExpressions = this.selectableExpressions.filter((expr, index) => {
            return !this.selectableExpressions.some((other, otherIndex) => 
                otherIndex !== index &&
                other.startIndex <= expr.startIndex &&
                other.endIndex >= expr.endIndex &&
                other.expression.length > expr.expression.length
            );
        });

        // Sort by start position for consistent ordering
        this.selectableExpressions.sort((a, b) => a.startIndex - b.startIndex);
        
        console.log('Generated selectable expressions:', this.selectableExpressions);
    }

    private handleMathClick(event: MouseEvent): void {
        const target = event.target as HTMLElement;
        
        // Check if the clicked element is a selectable term (label or checkbox)
        const selectableTerm = target.closest('.selectable-term') as HTMLElement;
        
        if (selectableTerm) {
            // Get the term ID and find the corresponding expression
            const termId = selectableTerm.getAttribute('data-term-id');
            const expressionText = selectableTerm.getAttribute('data-expression');
            
            if (termId && expressionText) {
                const termIndex = parseInt(termId);
                const expression = this.selectableExpressions[termIndex];
                
                if (expression) {
                    // Find the checkbox within the label
                    const checkbox = selectableTerm.querySelector('input[type="checkbox"]') as HTMLInputElement;
                    
                    // Toggle selection - if already selected, deselect; otherwise select
                    if (this.selectedExpression && this.selectedExpression.expression === expression.expression) {
                        this.clearSelection();
                        if (checkbox) checkbox.checked = false;
                        this.addDebugMessage('🔄 Deselected term (toggle)');
                    } else {
                        this.selectExpression(expression);
                        if (checkbox) checkbox.checked = true;
                        this.addDebugMessage(`🎯 Selected term: "${expression.expression}" (type: ${expression.type})`);
                    }
                    return;
                }
            }
        }
        
        // Fallback: if no selectable term was clicked, try the old cycling approach
        if (this.selectableExpressions.length === 0) {
            this.addDebugMessage('⚠️ No selectable expressions available');
            return;
        }

        // Cycle through expressions if clicking on non-selectable area
        let selectedIndex = 0;
        if (this.selectedExpression) {
            const currentIndex = this.selectableExpressions.findIndex(expr => 
                expr.expression === this.selectedExpression!.expression
            );
            selectedIndex = (currentIndex + 1) % this.selectableExpressions.length;
        }
        
        const expression = this.selectableExpressions[selectedIndex];
        this.selectExpression(expression);
        this.addDebugMessage(`🔄 Cycled to term: "${expression.expression}"`);
    }

    private selectExpression(expression: SelectableExpression): void {
        this.selectedExpression = expression;
        this.selectedExpressionSpan.textContent = expression.expression;
        
        // Update the expression input to show only the selected term
        this.expressionInput.value = expression.expression;
        
        // Enable the edit term button and transformations button
        this.editTermBtn.disabled = false;
        this.getTransformationsBtn.disabled = false;
        
        // Add visual highlighting to the math display (simplified approach)
        this.highlightSelectedTerm(expression);
        
        this.addDebugMessage(`🎯 Selected term: "${expression.expression}"`);
        console.log('Selected expression:', expression.expression);
    }

    private highlightSelectedTerm(expression: SelectableExpression): void {
        // Remove previous highlights from all selectable terms and uncheck all checkboxes
        const allSelectableTerms = this.renderedMath.querySelectorAll('.selectable-term');
        allSelectableTerms.forEach(term => {
            (term as HTMLElement).style.backgroundColor = '';
            (term as HTMLElement).style.border = '';
            (term as HTMLElement).classList.remove('selected');
            
            // Uncheck the checkbox within this term
            const checkbox = term.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) checkbox.checked = false;
        });
        
        // Remove general equation highlighting
        this.renderedMath.style.backgroundColor = '';
        this.renderedMath.style.borderRadius = '';
        this.renderedMath.style.padding = '';
        
        // Find and highlight the specific selected term
        const selectedTermElement = this.renderedMath.querySelector(`[data-expression="${expression.expression.replace(/"/g, '&quot;')}"]`) as HTMLElement;
        
        if (selectedTermElement) {
            selectedTermElement.style.backgroundColor = 'rgba(102, 126, 234, 0.2)';
            selectedTermElement.style.border = '2px solid rgba(102, 126, 234, 0.5)';
            selectedTermElement.classList.add('selected');
            
            // Check the checkbox within this term
            const checkbox = selectedTermElement.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) checkbox.checked = true;
            
            // Store reference to the selected element
            expression.element = selectedTermElement;
            
            this.addDebugMessage(`✨ Highlighted selected term: "${expression.expression}"`);
        } else {
            // Fallback: highlight the entire equation area if specific term not found
            this.renderedMath.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
            this.renderedMath.style.borderRadius = '4px';
            this.renderedMath.style.padding = '5px';
            
            this.addDebugMessage(`⚠️ Could not find specific term element, using fallback highlighting`);
        }
    }

    private clearSelection(): void {
        this.selectedExpression = null;
        this.selectedExpressionSpan.textContent = 'None';
        this.expressionInput.value = '';
        this.expressionInput.placeholder = 'No term selected...';
        
        // Disable buttons
        this.editTermBtn.disabled = true;
        this.getTransformationsBtn.disabled = true;
        this.transformationsPanel.style.display = 'none';
        
        // Remove highlighting from all selectable terms and uncheck all checkboxes
        const allSelectableTerms = this.renderedMath.querySelectorAll('.selectable-term');
        allSelectableTerms.forEach(term => {
            (term as HTMLElement).style.backgroundColor = '';
            (term as HTMLElement).style.border = '';
            (term as HTMLElement).classList.remove('selected');
            
            // Uncheck the checkbox within this term
            const checkbox = term.querySelector('input[type="checkbox"]') as HTMLInputElement;
            if (checkbox) checkbox.checked = false;
        });
        
        // Remove general equation highlighting
        this.renderedMath.style.backgroundColor = '';
        this.renderedMath.style.borderRadius = '';
        this.renderedMath.style.padding = '';
        
        this.addDebugMessage('🧹 Cleared selection and highlighting');
    }

    private async getTransformations(): Promise<void> {
        if (!this.selectedExpression) return;

        // Dummy implementation - in real app, this would be a REST call
        const dummyTransformations = this.generateDummyTransformations(this.selectedExpression.expression);
        
        this.displayTransformations(dummyTransformations);
    }

    private generateDummyTransformations(expression: string): TransformationResponse {
        // Generate dummy transformations based on the expression type
        const transformations: Transformation[] = [];

        if (expression.includes('sin') || expression.includes('cos')) {
            transformations.push({
                section: expression,
                replacements: [
                    '\\cos^2(x) + \\sin^2(x)',
                    '1 - \\cos^2(x)',
                    '1 - \\sin^2(x)'
                ]
            });
        }

        if (expression.includes('frac')) {
            transformations.push({
                section: expression,
                replacements: [
                    'decimal approximation',
                    'simplified form',
                    'rationalized form'
                ]
            });
        }

        if (expression.includes('^')) {
            transformations.push({
                section: expression,
                replacements: [
                    'expanded form',
                    'logarithmic form',
                    'factored form'
                ]
            });
        }

        // Default transformations
        if (transformations.length === 0) {
            transformations.push({
                section: expression,
                replacements: [
                    'simplified',
                    'expanded',
                    'factored',
                    'substituted'
                ]
            });
        }

        return { transformations };
    }

    private displayTransformations(response: TransformationResponse): void {
        this.transformationsList.innerHTML = '';
        
        response.transformations.forEach(transformation => {
            const item = document.createElement('div');
            item.className = 'transformation-item';
            
            const section = document.createElement('div');
            section.className = 'transformation-section';
            section.textContent = `Transform: ${transformation.section}`;
            
            const options = document.createElement('div');
            options.className = 'transformation-options';
            
            transformation.replacements.forEach(replacement => {
                const option = document.createElement('span');
                option.className = 'transformation-option';
                option.textContent = replacement;
                option.addEventListener('click', () => this.applyTransformation(transformation.section, replacement));
                options.appendChild(option);
            });
            
            item.appendChild(section);
            item.appendChild(options);
            this.transformationsList.appendChild(item);
        });
        
        this.transformationsPanel.style.display = 'block';
    }

    private applyTransformation(section: string, replacement: string): void {
        // Replace the selected section with the chosen replacement
        const newExpression = this.currentExpression.replace(section, replacement);
        this.currentExpression = newExpression;
        this.renderExpression(newExpression);
        this.clearSelection();
    }

    // New term editor methods
    private openTermEditor(): void {
        if (!this.selectedExpression) return;
        
        this.originalTermValue = this.selectedExpression.expression;
        this.termEditorInput.value = this.selectedExpression.expression;
        this.updateTermPreview();
        this.checkForFunctionArguments(this.selectedExpression.expression);
        this.termEditorModal.style.display = 'flex';
        this.termEditorInput.focus();
        
        this.addDebugMessage(`🔧 Opened term editor for: "${this.selectedExpression.expression}"`);
    }

    private closeTermEditor(): void {
        this.termEditorModal.style.display = 'none';
        this.functionArgsSection.style.display = 'none';
        this.argsContainer.innerHTML = '';
        this.addDebugMessage('❌ Closed term editor');
    }

    private cancelTermEdit(): void {
        this.termEditorInput.value = this.originalTermValue;
        this.closeTermEditor();
        this.addDebugMessage('🚫 Cancelled term edit');
    }

    private applyTermEdit(): void {
        if (!this.selectedExpression) return;
        
        const newTermValue = this.termEditorInput.value.trim();
        if (newTermValue === '') {
            alert('Term cannot be empty');
            return;
        }
        
        // Replace the selected term in the full equation
        const newExpression = this.currentExpression.replace(this.selectedExpression.expression, newTermValue);
        this.currentExpression = newExpression;
        
        // Update the selected expression
        this.selectedExpression.expression = newTermValue;
        this.expressionInput.value = newTermValue;
        this.selectedExpressionSpan.textContent = newTermValue;
        
        // Re-render the equation
        this.renderExpression(this.currentExpression);
        this.closeTermEditor();
        
        this.addDebugMessage(`✅ Applied term edit: "${this.originalTermValue}" → "${newTermValue}"`);
    }

    private updateTermPreview(): void {
        const expressionText = this.termEditorInput.value.trim();
        
        try {
            if (expressionText === '') {
                this.termPreviewDisplay.innerHTML = '<span style="color: #999; font-style: italic;">Enter expression...</span>';
                return;
            }
            
            const mathElement = (MathJax as any).tex2chtml(expressionText, {
                display: false,
                em: 16,
                ex: 8,
                containerWidth: 1200
            });
            const rendered = mathElement.outerHTML;
            
            this.termPreviewDisplay.innerHTML = rendered;
        } catch (error) {
            this.termPreviewDisplay.innerHTML = `<span style="color: #cc0000;">Error: ${expressionText}</span>`;
        }
    }

    private handleTermEditorShortcuts(event: KeyboardEvent): void {
        // Common MathJax shortcuts for term editor
        const shortcuts: { [key: string]: string } = {
            'alpha': '\\alpha',
            'beta': '\\beta',
            'gamma': '\\gamma',
            'delta': '\\delta',
            'pi': '\\pi',
            'theta': '\\theta',
            'lambda': '\\lambda',
            'mu': '\\mu',
            'sigma': '\\sigma',
            'phi': '\\phi',
            'omega': '\\omega',
            'sum': '\\sum',
            'int': '\\int',
            'lim': '\\lim',
            'sqrt': '\\sqrt{}',
            'frac': '\\frac{}{}',
            'sin': '\\sin',
            'cos': '\\cos',
            'tan': '\\tan',
            'log': '\\log',
            'ln': '\\ln',
            'infty': '\\infty'
        };

        // Check for Tab key to trigger shortcuts
        if (event.key === 'Tab') {
            event.preventDefault();
            const textarea = this.termEditorInput;
            const cursorPos = textarea.selectionStart || 0;
            const text = textarea.value;
            
            // Find the word before cursor
            let wordStart = cursorPos - 1;
            while (wordStart >= 0 && /[a-zA-Z]/.test(text[wordStart])) {
                wordStart--;
            }
            wordStart++;
            
            const word = text.substring(wordStart, cursorPos);
            if (shortcuts[word]) {
                const newText = text.substring(0, wordStart) + shortcuts[word] + text.substring(cursorPos);
                textarea.value = newText;
                
                // Position cursor appropriately
                let newCursorPos = wordStart + shortcuts[word].length;
                if (shortcuts[word].includes('{}')) {
                    newCursorPos = wordStart + shortcuts[word].indexOf('{}') + 1;
                }
                
                textarea.setSelectionRange(newCursorPos, newCursorPos);
                this.updateTermPreview();
            }
        }
        
        // Ctrl+Enter to apply changes
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            this.applyTermEdit();
        }
    }

    private checkForFunctionArguments(expression: string): void {
        // Check if the term is a function that could have arguments
        const functionPatterns = [
            { pattern: /\\(sin|cos|tan|log|ln|sqrt|frac)\{([^}]*)\}/g, name: 'function' },
            { pattern: /\\frac\{([^}]*)\}\{([^}]*)\}/g, name: 'fraction' },
            { pattern: /\\sqrt\[([^}]*)\]\{([^}]*)\}/g, name: 'root' }
        ];

        let hasArguments = false;
        this.argsContainer.innerHTML = '';

        functionPatterns.forEach(({ pattern, name }) => {
            let match;
            while ((match = pattern.exec(expression)) !== null) {
                hasArguments = true;
                this.createArgumentInputs(match, name);
            }
        });

        this.functionArgsSection.style.display = hasArguments ? 'block' : 'none';
    }

    private createArgumentInputs(match: RegExpExecArray, functionType: string): void {
        const args = match.slice(1); // Remove the full match, keep capture groups
        
        args.forEach((arg, index) => {
            const argDiv = document.createElement('div');
            argDiv.className = 'arg-input';
            
            const label = document.createElement('label');
            label.textContent = `Arg ${index + 1}:`;
            
            const input = document.createElement('input');
            input.type = 'text';
            input.value = arg;
            input.addEventListener('input', () => this.updateTermFromArguments());
            
            argDiv.appendChild(label);
            argDiv.appendChild(input);
            this.argsContainer.appendChild(argDiv);
        });
    }

    private updateTermFromArguments(): void {
        // This would reconstruct the MathJax expression from the argument inputs
        // For now, just update the preview when arguments change
        this.updateTermPreview();
    }

    // Expose methods for testing purposes
    public testGenerateSelectableExpressions(expression: string): void {
        return this.generateSelectableExpressions(expression);
    }

    public testCreateClickableEquation(expression: string, renderedHtml: string): string {
        return this.createClickableEquation(expression, renderedHtml);
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const editor = new EquationEditor();
    // Make the editor globally accessible for testing
    (window as any).equationEditor = editor;
});
