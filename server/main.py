"""
Main FastAPI application for the Math Expression Rewriting API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, Any
import sympy as sp
from lxml import etree

from schemas import (
    ParseRequest, ParseResponse, 
    RewriteRequest, RewriteResponse, RewriteStep,
    ExpressionFormat, RewriteRule,
    RewriteOptionsRequest, RewriteOptionsResponse, RewriteOption
)

app = FastAPI(
    title="Math Expression Rewriting API",
    description="Computer Assisted Math Expression Rewriting Web Application Backend",
    version="1.0.0",
)

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    # Allow common local dev origins (localhost/127.0.0.1 on any port)
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    """Response model for health check endpoint."""
    status: str
    message: str
    services: Dict[str, str]


@app.get("/")
async def root() -> Dict[str, str]:
    """Root endpoint returning Hello World message."""
    return {
        "message": "Hello World from Math Expression Rewriting API",
        "status": "running",
        "version": "1.0.0"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint with service status."""
    # Test SymPy functionality
    try:
        x = sp.Symbol('x')
        expr = x**2 + 2*x + 1
        factored = sp.factor(expr)
        sympy_status = f"OK - Test: {expr} -> {factored}"
    except Exception as e:
        sympy_status = f"ERROR - {str(e)}"
    
    # Test lxml functionality
    try:
        root = etree.Element("math")
        etree.SubElement(root, "mi").text = "x"
        lxml_status = "OK - MathML processing available"
    except Exception as e:
        lxml_status = f"ERROR - {str(e)}"
    
    return HealthResponse(
        status="healthy",
        message="Math Expression Rewriting API is running",
        services={
            "fastapi": "OK",
            "sympy": sympy_status,
            "lxml": lxml_status
        }
    )


@app.post("/api/parse", response_model=ParseResponse)
async def parse_expression(request: ParseRequest) -> ParseResponse:
    """Parse mathematical expressions and convert between formats."""
    try:
        # For now, return a basic implementation
        # TODO: Implement full parsing logic with format conversion
        
        # Basic SymPy parsing for demonstration
        if request.input_format == ExpressionFormat.LATEX:
            # Simple LaTeX to SymPy conversion (placeholder)
            expr_str = request.expression.replace("\\frac", "").replace("{", "(").replace("}", ")")
        else:
            expr_str = request.expression
            
        # Parse with SymPy
        expr = sp.sympify(expr_str)
        variables = [str(var) for var in expr.free_symbols]
        
        # Convert to requested output format
        if request.output_format == ExpressionFormat.MATHML:
            # Basic MathML generation (placeholder)
            parsed_expr = f"<math><mi>{expr}</mi></math>"
        elif request.output_format == ExpressionFormat.LATEX:
            parsed_expr = sp.latex(expr)
        else:
            parsed_expr = str(expr)
        
        return ParseResponse(
            success=True,
            parsed_expression=parsed_expr,
            ast_structure={"type": "expression", "value": str(expr)},
            variables=variables
        )
        
    except Exception as e:
        return ParseResponse(
            success=False,
            error_message=f"Parsing failed: {str(e)}"
        )


@app.post("/api/rewrite", response_model=RewriteResponse)
async def rewrite_expression(request: RewriteRequest) -> RewriteResponse:
    """Rewrite mathematical expressions using specified rules."""
    try:
        # Parse the input expression
        if request.input_format == ExpressionFormat.LATEX:
            expr_str = request.expression.replace("\\frac", "").replace("{", "(").replace("}", ")")
        else:
            expr_str = request.expression
            
        original_expr = sp.sympify(expr_str)
        current_expr = original_expr
        steps = []
        
        # Apply each rewrite rule
        for rule in request.rules:
            expr_before = current_expr
            
            if rule == RewriteRule.SIMPLIFY:
                current_expr = sp.simplify(current_expr)
                description = "Applied simplification"
            elif rule == RewriteRule.EXPAND:
                current_expr = sp.expand(current_expr)
                description = "Expanded expression"
            elif rule == RewriteRule.FACTOR:
                current_expr = sp.factor(current_expr)
                description = "Factored expression"
            elif rule == RewriteRule.COLLECT:
                # Collect with respect to first variable if any
                if current_expr.free_symbols:
                    var = list(current_expr.free_symbols)[0]
                    current_expr = sp.collect(current_expr, var)
                    description = f"Collected terms with respect to {var}"
                else:
                    description = "No variables to collect"
            else:
                description = f"Applied {rule.value}"
            
            steps.append(RewriteStep(
                rule=rule,
                expression_before=str(expr_before),
                expression_after=str(current_expr),
                description=description
            ))
        
        # Generate output formats
        mathml_output = f"<math><mi>{current_expr}</mi></math>"
        latex_output = sp.latex(current_expr)
        
        if request.output_format == ExpressionFormat.MATHML:
            final_expr = mathml_output
        elif request.output_format == ExpressionFormat.LATEX:
            final_expr = latex_output
        else:
            final_expr = str(current_expr)
        
        return RewriteResponse(
            success=True,
            original_expression=str(original_expr),
            final_expression=final_expr,
            steps=steps,
            mathml_output=mathml_output,
            latex_output=latex_output
        )
        
    except Exception as e:
        return RewriteResponse(
            success=False,
            original_expression=request.expression,
            error_message=f"Rewriting failed: {str(e)}"
        )


def _parse_content_mathml_to_sympy(content: str) -> sp.Expr:
    """Very small subset Content MathML -> SymPy parser sufficient for demo.
    Supports: <ci>, <cn>, <apply><power/>, <apply><plus/>, <apply><times/>, <apply><sin/></apply>
    It expects a single <math> root or a direct <apply>/<ci>/<cn> root.
    """
    try:
        root = etree.fromstring(content.encode('utf-8'))
    except Exception:
        # maybe content already without <math> wrapper
        root = etree.fromstring(f"<math xmlns='http://www.w3.org/1998/Math/MathML'>{content}</math>".encode('utf-8'))

    # If root is <math>, descend to first child element
    if root.tag.endswith('math') and len(root) > 0:
        node = root[0]
    else:
        node = root

    ns = '{http://www.w3.org/1998/Math/MathML}'

    def parse_node(n) -> sp.Expr:
        tag = n.tag
        if tag.endswith('ci'):
            name = (n.text or '').strip() or 'x'
            return sp.Symbol(name)
        if tag.endswith('cn'):
            txt = (n.text or '0').strip()
            try:
                return sp.Integer(int(txt))
            except Exception:
                try:
                    return sp.Rational(txt)
                except Exception:
                    return sp.Symbol(txt)
        if tag.endswith('apply'):
            if len(n) == 0:
                raise ValueError('empty apply')
            head = n[0]
            # Operators are empty elements like <power/>, <plus/>, <times/>, <sin/>
            op_tag = head.tag
            args = [parse_node(child) for child in n[1:]]
            if op_tag.endswith('power') and len(args) == 2:
                return args[0] ** args[1]
            if op_tag.endswith('plus'):
                if not args:
                    return sp.Integer(0)
                return sp.Add(*args)
            if op_tag.endswith('times'):
                if not args:
                    return sp.Integer(1)
                return sp.Mul(*args)
            if op_tag.endswith('sin') and len(args) == 1:
                return sp.sin(args[0])
            if op_tag.endswith('cos') and len(args) == 1:
                return sp.cos(args[0])
            # Fallback: treat head as function symbol
            if head.tag.endswith('ci') and args:
                f = sp.Function((head.text or 'f').strip())
                return f(*args)
            raise ValueError(f'Unsupported operator: {op_tag}')
        # Unknown tag: try children
        if len(n) == 1:
            return parse_node(n[0])
        raise ValueError(f'Unsupported tag: {tag}')

    return parse_node(node)


def _sympy_to_mathml_strings(expr: sp.Expr) -> (str, str):
    """Return (content_mathml, presentation_mathml) strings for expr.
    Falls back to a basic Presentation MathML printer for common constructs to
    avoid embedding raw LaTeX inside <mi> (which would show as text).
    """
    from sympy.printing.mathml import mathml as sympy_mathml

    def pres_basic(e: sp.Expr) -> str:
        # Minimal presentation MathML for: Symbol, Integer, Add, Mul, Pow, sin, cos
        ns = "http://www.w3.org/1998/Math/MathML"
        def wrap(inner: str) -> str:
            return f"<math xmlns=\"{ns}\" display=\"block\">{inner}</math>"
        if isinstance(e, sp.Symbol):
            return wrap(f"<mi>{sp.sstr(e)}</mi>")
        if isinstance(e, sp.Integer):
            return wrap(f"<mn>{int(e)}</mn>")
        if isinstance(e, sp.Pow):
            base = pres_basic_inner(e.base)
            exp = pres_basic_inner(e.exp)
            return wrap(f"<msup><mrow>{base}</mrow>{exp}</msup>")
        if isinstance(e, sp.Add):
            terms = [pres_basic_inner(t) for t in e.as_ordered_terms()]
            if not terms:
                return wrap("<mn>0</mn>")
            inner = terms[0] + ''.join(f"<mo>+</mo>{t}" for t in terms[1:])
            return wrap(f"<mrow>{inner}</mrow>")
        if isinstance(e, sp.Mul):
            factors = [pres_basic_inner(t) for t in e.as_ordered_factors()]
            if not factors:
                return wrap("<mn>1</mn>")
            inner = ''.join(f"<mrow>{f}</mrow>" if i == 0 else f"<mo>·</mo>{f}" for i, f in enumerate(factors))
            return wrap(f"<mrow>{inner}</mrow>")
        if isinstance(e, sp.sin):
            arg = pres_basic_inner(e.args[0])
            return wrap(f"<mrow><mi>sin</mi><mo>(</mo>{arg}<mo>)</mo></mrow>")
        if isinstance(e, sp.cos):
            arg = pres_basic_inner(e.args[0])
            return wrap(f"<mrow><mi>cos</mi><mo>(</mo>{arg}<mo>)</mo></mrow>")
        # Fallback to sstr text as <mtext>
        return wrap(f"<mtext>{sp.sstr(e)}</mtext>")

    def pres_basic_inner(e: sp.Expr) -> str:
        # Same as pres_basic but returns inner (no <math> wrapper)
        if isinstance(e, sp.Symbol):
            return f"<mi>{sp.sstr(e)}</mi>"
        if isinstance(e, sp.Integer):
            return f"<mn>{int(e)}</mn>"
        if isinstance(e, sp.Pow):
            return f"<msup><mrow>{pres_basic_inner(e.base)}</mrow>{pres_basic_inner(e.exp)}</msup>"
        if isinstance(e, sp.Add):
            terms = [pres_basic_inner(t) for t in e.as_ordered_terms()]
            return f"<mrow>{terms[0]}{''.join(f'<mo>+</mo>{t}' for t in terms[1:])}</mrow>" if terms else "<mn>0</mn>"
        if isinstance(e, sp.Mul):
            factors = [pres_basic_inner(t) for t in e.as_ordered_factors()]
            if not factors:
                return "<mn>1</mn>"
            inner = ''.join(factors[:1] + [f"<mo>·</mo>{f}" for f in factors[1:]])
            return f"<mrow>{inner}</mrow>"
        if isinstance(e, sp.sin):
            return f"<mrow><mi>sin</mi><mo>(</mo>{pres_basic_inner(e.args[0])}<mo>)</mo></mrow>"
        if isinstance(e, sp.cos):
            return f"<mrow><mi>cos</mi><mo>(</mo>{pres_basic_inner(e.args[0])}<mo>)</mo></mrow>"
        return f"<mtext>{sp.sstr(e)}</mtext>"

    try:
        # content
        c_el = sympy_mathml(expr, printer='content')
        p_el = sympy_mathml(expr, printer='presentation')
        c_str = etree.tostring(c_el, encoding='unicode')
        p_str = etree.tostring(p_el, encoding='unicode')
        # Ensure <math xmlns=...> wrapper
        if not c_str.startswith('<math'):
            c_str = f"<math xmlns=\"http://www.w3.org/1998/Math/MathML\">{c_str}</math>"
        if not p_str.startswith('<math'):
            p_str = f"<math xmlns=\"http://www.w3.org/1998/Math/MathML\" display=\"block\">{p_str}</math>"
        return c_str, p_str
    except Exception:
        # Fallback: Avoid <mtext> in Content MathML; use <ci> with sstr text instead.
        safe_text = sp.sstr(expr)
        c_str = f"<math xmlns=\"http://www.w3.org/1998/Math/MathML\"><ci>{safe_text}</ci></math>"
        p_str = pres_basic(expr)
        return c_str, p_str


def _generate_rewrite_options(expr: sp.Expr) -> list[RewriteOption]:
    options: list[RewriteOption] = []
    x = sp.Wild('x')
    a = sp.Wild('a')
    b = sp.Wild('b')
    base = sp.Wild('base')

    # 1) sin(x)^2 -> 1 - cos(x)^2
    try:
        if isinstance(expr, sp.Pow) and isinstance(expr.base, sp.sin) and expr.exp == 2:
            inner = expr.base.args[0]
            replacement = 1 - sp.cos(inner) ** 2
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='sin2_to_1_minus_cos2',
                label='Use identity: sin(x)^2 = 1 - cos(x)^2',
                ruleName='trig_identity_sin2',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))
    except Exception:
        pass

    # 1b) sin(2x) -> 2 sin(x) cos(x)
    try:
        if isinstance(expr, sp.sin):
            arg = expr.args[0]
            coeff, rest = sp.sympify(arg).as_coeff_Mul()
            if coeff == 2:
                replacement = 2 * sp.sin(rest) * sp.cos(rest)
                cid, pid = _sympy_to_mathml_strings(replacement)
                options.append(RewriteOption(
                    id='sin_double_angle',
                    label='Double-angle: sin(2x) = 2·sin(x)·cos(x)',
                    ruleName='trig_double_angle_sin',
                    replacementContentMathML=cid,
                    replacementPresentationMathML=pid,
                ))
    except Exception:
        pass

    # 2) a + a -> 2a
    if isinstance(expr, sp.Add) and len(expr.args) == 2:
        lhs, rhs = expr.args
        if sp.simplify(lhs - rhs) == 0:
            replacement = 2 * lhs
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='a_plus_a_to_2a',
                label='Combine like terms: a + a → 2a',
                ruleName='combine_like_terms_add',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))

    # 3) a*a -> a^2
    if isinstance(expr, sp.Mul) and len(expr.args) == 2:
        lhs, rhs = expr.args
        if sp.simplify(lhs - rhs) == 0:
            replacement = lhs ** 2
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='a_mul_a_to_a2',
                label='Square: a·a → a^2',
                ruleName='square_product',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))

    # 4) x^a * x^b -> x^(a+b)
    if isinstance(expr, sp.Mul) and len(expr.args) == 2:
        A, B = expr.args
        if isinstance(A, sp.Pow) and isinstance(B, sp.Pow) and sp.simplify(A.base - B.base) == 0:
            replacement = A.base ** (A.exp + B.exp)
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='same_base_mul_pows',
                label='Combine exponents: x^a · x^b → x^(a+b)',
                ruleName='combine_exponents',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))

    # 5) (a^b)^c -> a^(b*c)
    if isinstance(expr, sp.Pow) and isinstance(expr.base, sp.Pow):
        A = expr.base.base
        B = expr.base.exp
        C = expr.exp
        replacement = A ** (B * C)
        cid, pid = _sympy_to_mathml_strings(replacement)
        options.append(RewriteOption(
            id='power_of_power',
            label='Power of a power: (a^b)^c → a^(b·c)',
            ruleName='power_of_power',
            replacementContentMathML=cid,
            replacementPresentationMathML=pid,
        ))

    # 5b) log(a^b) -> b * log(a)  (assumes a>0)
    try:
        if isinstance(expr, sp.log):
            inner = expr.args[0]
            if isinstance(inner, sp.Pow):
                replacement = inner.exp * sp.log(inner.base)
                cid, pid = _sympy_to_mathml_strings(replacement)
                options.append(RewriteOption(
                    id='log_power_pullout',
                    label='Log power rule: log(a^b) = b·log(a) (assumes a>0)',
                    ruleName='log_power_pullout',
                    replacementContentMathML=cid,
                    replacementPresentationMathML=pid,
                ))
            # 5c) log(a*b) -> log(a) + log(b)  (assumes a>0,b>0)
            if isinstance(inner, sp.Mul) and len(inner.args) == 2:
                u, v = inner.args
                replacement2 = sp.log(u) + sp.log(v)
                cid2, pid2 = _sympy_to_mathml_strings(replacement2)
                options.append(RewriteOption(
                    id='log_product_split',
                    label='Product to sum: log(ab) = log(a) + log(b) (assumes a>0, b>0)',
                    ruleName='log_product_to_sum',
                    replacementContentMathML=cid2,
                    replacementPresentationMathML=pid2,
                ))
    except Exception:
        pass

    # 6) x - y -> x + (-y) (best-effort visualization)
    # Detect a two-term Add where the second term is negative after factoring -1
    if isinstance(expr, sp.Add) and len(expr.args) == 2:
        p, q = expr.args
        if q.could_extract_minus_sign():
            replacement = p + (-q)
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='sub_to_add_neg',
                label='Rewrite subtraction: x - y → x + (-y)',
                ruleName='sub_as_add_neg',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))

    # --- Reverse rules: offer LHS when RHS is selected ---
    # R1: 2·sin(x)·cos(x) -> sin(2x)
    try:
        if isinstance(expr, sp.Mul):
            coeff, rest = expr.as_coeff_Mul()
            if coeff == 2:
                rest_factors = list(rest.as_ordered_factors()) if isinstance(rest, sp.Mul) else [rest]
                sin_args = [f.args[0] for f in rest_factors if isinstance(f, sp.sin)]
                cos_args = [f.args[0] for f in rest_factors if isinstance(f, sp.cos)]
                # find a common argument between sin and cos
                for arg in sin_args:
                    if any(sp.simplify(arg - c) == 0 for c in cos_args):
                        replacement = sp.sin(2*arg)
                        cid, pid = _sympy_to_mathml_strings(replacement)
                        options.append(RewriteOption(
                            id='sin_double_angle_reverse',
                            label='Double-angle (reverse): 2·sin(x)·cos(x) → sin(2x)',
                            ruleName='trig_double_angle_sin',
                            replacementContentMathML=cid,
                            replacementPresentationMathML=pid,
                        ))
                        break
    except Exception:
        pass

    # R2: 1 - cos(x)^2 -> sin(x)^2
    try:
        def _match_one_minus_cos2(e: sp.Expr):
            if not isinstance(e, sp.Add) or len(e.args) != 2:
                return None
            p, q = e.args
            def check(one, other):
                if one == 1 and other.could_extract_minus_sign():
                    op = -other
                    if isinstance(op, sp.Pow) and op.exp == 2 and isinstance(op.base, sp.cos):
                        return op.base.args[0]
                return None
            return check(p, q) or check(q, p)
        arg = _match_one_minus_cos2(expr)
        if arg is not None:
            replacement = sp.sin(arg) ** 2
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='sin2_identity_reverse',
                label='Use identity (reverse): 1 - cos(x)^2 → sin(x)^2',
                ruleName='trig_identity_sin2',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))
    except Exception:
        pass

    # R3: 2a -> a + a
    try:
        if isinstance(expr, sp.Mul):
            coeff, rest = expr.as_coeff_Mul()
            if coeff == 2 and rest != 1:
                replacement = rest + rest
                cid, pid = _sympy_to_mathml_strings(replacement)
                options.append(RewriteOption(
                    id='two_a_to_a_plus_a',
                    label='Split coefficient (reverse): 2a → a + a',
                    ruleName='combine_like_terms_add',
                    replacementContentMathML=cid,
                    replacementPresentationMathML=pid,
                ))
    except Exception:
        pass

    # R4: a^2 -> a·a
    try:
        if isinstance(expr, sp.Pow) and expr.exp == 2:
            replacement = expr.base * expr.base
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='square_to_product_reverse',
                label='Square to product (reverse): a^2 → a·a',
                ruleName='square_product',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))
    except Exception:
        pass

    # R5: x^(a+b) -> x^a · x^b
    try:
        if isinstance(expr, sp.Pow) and isinstance(expr.exp, sp.Add) and len(expr.exp.args) == 2:
            A = expr.base
            B, C = expr.exp.args
            replacement = (A ** B) * (A ** C)
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='combine_exponents_reverse',
                label='Split exponents (reverse): x^(a+b) → x^a · x^b',
                ruleName='combine_exponents',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))
    except Exception:
        pass

    # R6: a^(b·c) -> (a^b)^c
    try:
        if isinstance(expr, sp.Pow) and isinstance(expr.exp, sp.Mul) and len(expr.exp.args) == 2:
            A = expr.base
            B, C = expr.exp.args
            replacement = (A ** B) ** C
            cid, pid = _sympy_to_mathml_strings(replacement)
            options.append(RewriteOption(
                id='power_of_power_reverse',
                label='Power of a power (reverse): a^(b·c) → (a^b)^c',
                ruleName='power_of_power',
                replacementContentMathML=cid,
                replacementPresentationMathML=pid,
            ))
    except Exception:
        pass

    # R7: b·log(a) -> log(a^b)
    try:
        if isinstance(expr, sp.Mul) and len(expr.args) == 2:
            u, v = expr.args
            if isinstance(u, sp.log):
                replacement = sp.log(u.args[0] ** v)
            elif isinstance(v, sp.log):
                replacement = sp.log(v.args[0] ** u)
            else:
                replacement = None
            if replacement is not None:
                cid, pid = _sympy_to_mathml_strings(replacement)
                options.append(RewriteOption(
                    id='log_power_pullout_reverse',
                    label='Log power rule (reverse): b·log(a) → log(a^b)',
                    ruleName='log_power_pullout',
                    replacementContentMathML=cid,
                    replacementPresentationMathML=pid,
                ))
    except Exception:
        pass

    # R8: log(a) + log(b) -> log(a·b)
    try:
        if isinstance(expr, sp.Add) and len(expr.args) == 2:
            u, v = expr.args
            if isinstance(u, sp.log) and isinstance(v, sp.log):
                replacement = sp.log(u.args[0] * v.args[0])
                cid, pid = _sympy_to_mathml_strings(replacement)
                options.append(RewriteOption(
                    id='log_product_to_sum_reverse',
                    label='Product to sum (reverse): log(a)+log(b) → log(a·b)',
                    ruleName='log_product_to_sum',
                    replacementContentMathML=cid,
                    replacementPresentationMathML=pid,
                ))
    except Exception:
        pass

    # R9: x + (-y) -> x - y
    try:
        if isinstance(expr, sp.Add) and len(expr.args) == 2:
            p, q = expr.args
            if q.could_extract_minus_sign():
                y = -q
                replacement = p - y
                # Avoid identity suggestion
                if sp.simplify(replacement - expr) != 0:
                    cid, pid = _sympy_to_mathml_strings(replacement)
                    options.append(RewriteOption(
                        id='add_neg_as_sub',
                        label='Rewrite addition of negative (reverse): x + (-y) → x - y',
                        ruleName='sub_as_add_neg',
                        replacementContentMathML=cid,
                        replacementPresentationMathML=pid,
                    ))
    except Exception:
        pass

    # Normalization / de-duplication by replacement content
    seen: set[str] = set()
    deduped: list[RewriteOption] = []
    for opt in options:
        key = opt.replacementContentMathML.strip()
        if key not in seen:
            seen.add(key)
            deduped.append(opt)

    return deduped


# --- Minimal Content MathML AST for selection mapping ---
# The goal is to mirror the frontend's node-id strategy:
#   id = djb2(canonical(ast)) as unsigned 32-bit hex string
# Canonical forms:
#   ident:name
#   number:value
#   power(base,exponent)
#   add(term1,term2,...)  // preserves order
#   call:func(arg)

from typing import Optional, Tuple, Union, List, Dict

ASTNode = Dict[str, Any]


def _parse_content_mathml_to_ast(content: str) -> ASTNode:
    """Parse a small subset of Content MathML into a minimal AST preserving order.
    Supported: ci, cn, apply(power|plus|times|sin|cos|<ci>func)
    """
    # Some callers may send HTML-escaped MathML. Be tolerant and unescape first.
    try:
        import html as _html_mod
        content = _html_mod.unescape(content)
    except Exception:
        pass
    try:
        root = etree.fromstring(content.encode("utf-8"))
    except Exception:
        root = etree.fromstring(
            f"<math xmlns='http://www.w3.org/1998/Math/MathML'>{content}</math>".encode(
                "utf-8"
            )
        )

    node = root[0] if root.tag.endswith("math") and len(root) > 0 else root

    def to_ast(n) -> ASTNode:
        tag = n.tag
        if tag.endswith("ci"):
            name = (n.text or "").strip() or "x"
            return {"kind": "ident", "name": name}
        if tag.endswith("cn"):
            val = (n.text or "0").strip()
            return {"kind": "number", "value": val}
        if tag.endswith("apply"):
            if len(n) == 0:
                raise ValueError("empty apply")
            head = n[0]
            args = [to_ast(child) for child in n[1:]]
            htag = head.tag
            if htag.endswith("power") and len(args) == 2:
                return {"kind": "power", "base": args[0], "exponent": args[1]}
            if htag.endswith("plus"):
                return {"kind": "add", "terms": args}
            if htag.endswith("times"):
                # Represent a product as a call 'times' to keep it distinct from add.
                # We don't need an id for times specifically for current rules, but keep structure.
                return {"kind": "call", "func": "times", "arg": {"kind": "add", "terms": args}}
            if htag.endswith("sin") and len(args) == 1:
                return {"kind": "call", "func": "sin", "arg": args[0]}
            if htag.endswith("cos") and len(args) == 1:
                return {"kind": "call", "func": "cos", "arg": args[0]}
            if htag.endswith("tan") and len(args) == 1:
                return {"kind": "call", "func": "tan", "arg": args[0]}
            if htag.endswith("sec") and len(args) == 1:
                return {"kind": "call", "func": "sec", "arg": args[0]}
            if htag.endswith("csc") and len(args) == 1:
                return {"kind": "call", "func": "csc", "arg": args[0]}
            if htag.endswith("cot") and len(args) == 1:
                return {"kind": "call", "func": "cot", "arg": args[0]}
            if htag.endswith("ln") and len(args) == 1:
                # Map ln to log internally
                return {"kind": "call", "func": "log", "arg": args[0]}
            if head.tag.endswith("ci") and args:
                return {"kind": "call", "func": (head.text or "f").strip(), "arg": args[0]}
            raise ValueError(f"Unsupported operator: {htag}")
        # Unknown: descend if single child
        if len(n) == 1:
            return to_ast(n[0])
        raise ValueError(f"Unsupported tag: {tag}")

    return to_ast(node)


def _canonical(ast: ASTNode) -> str:
    k = ast["kind"]
    if k == "ident":
        return f"ident:{ast['name']}"
    if k == "number":
        return f"number:{ast['value']}"
    if k == "power":
        return f"power({_canonical(ast['base'])},{_canonical(ast['exponent'])})"
    if k == "add":
        return f"add({','.join(_canonical(t) for t in ast['terms'])})"
    if k == "call":
        return f"call:{ast['func']}({_canonical(ast['arg'])})"
    # Fallback for any unexpected node
    return f"unknown"


def _djb2_hex(s: str) -> str:
    h = 5381
    for ch in s:
        h = ((h << 5) + h) + ord(ch)
        h = h & 0xFFFFFFFF  # force 32-bit
    return format(h, 'x')


def _with_ids(ast: ASTNode) -> ASTNode:
    k = ast["kind"]
    if k in ("ident", "number"):
        node = dict(ast)
        node["id"] = _djb2_hex(_canonical(ast))
        return node
    if k == "power":
        base = _with_ids(ast["base"])  # type: ignore
        exp = _with_ids(ast["exponent"])  # type: ignore
        node = {"kind": "power", "base": base, "exponent": exp}
        node["id"] = _djb2_hex(_canonical(node))
        return node
    if k == "add":
        terms = [_with_ids(t) for t in ast["terms"]]  # type: ignore
        node = {"kind": "add", "terms": terms}
        node["id"] = _djb2_hex(_canonical(node))
        return node
    if k == "call":
        arg = _with_ids(ast["arg"])  # type: ignore
        node = {"kind": "call", "func": ast["func"], "arg": arg}
        node["id"] = _djb2_hex(_canonical(node))
        return node
    node = dict(ast)
    node["id"] = _djb2_hex(_canonical(ast))
    return node


def _find_node_by_id(ast: ASTNode, node_id: str) -> Optional[ASTNode]:
    if ast.get("id") == node_id:
        return ast
    k = ast.get("kind")
    if k == "power":
        return _find_node_by_id(ast["base"], node_id) or _find_node_by_id(ast["exponent"], node_id)
    if k == "add":
        for t in ast["terms"]:
            found = _find_node_by_id(t, node_id)
            if found:
                return found
    if k == "call":
        return _find_node_by_id(ast["arg"], node_id)
    return None


def _ast_to_sympy(ast: ASTNode) -> sp.Expr:
    k = ast["kind"]
    if k == "ident":
        return sp.Symbol(ast["name"])  # type: ignore
    if k == "number":
        txt = str(ast["value"])  # type: ignore
        try:
            return sp.Integer(int(txt))
        except Exception:
            try:
                return sp.Rational(txt)
            except Exception:
                return sp.Symbol(txt)
    if k == "power":
        return _ast_to_sympy(ast["base"]) ** _ast_to_sympy(ast["exponent"])  # type: ignore
    if k == "add":
        terms = [ _ast_to_sympy(t) for t in ast["terms"] ]  # type: ignore
        return sp.Add(*terms) if terms else sp.Integer(0)
    if k == "call":
        func = str(ast["func"]).lower()  # type: ignore
        arg = _ast_to_sympy(ast["arg"])  # type: ignore
        if func == "sin":
            return sp.sin(arg)
        if func == "cos":
            return sp.cos(arg)
        if func == "tan":
            return sp.tan(arg)
        if func == "sec":
            try:
                return sp.sec(arg)
            except Exception:
                # older SymPy versions may not expose sec directly
                return 1/sp.cos(arg)
        if func == "csc":
            try:
                return sp.csc(arg)
            except Exception:
                return 1/sp.sin(arg)
        if func == "cot":
            try:
                return sp.cot(arg)
            except Exception:
                return sp.cos(arg)/sp.sin(arg)
        if func == "log":
            return sp.log(arg)
        if func == "times":
            # we encoded times as call with arg being an add-like terms list
            inner = ast["arg"]
            if inner.get("kind") == "add":
                factors = [ _ast_to_sympy(t) for t in inner["terms"] ]
                return sp.Mul(*factors) if factors else sp.Integer(1)
            return arg
        # generic function symbol
        f = sp.Function(func)
        return f(arg)
    # Fallback
    return sp.Symbol("x")


@app.post('/rewriteOptions', response_model=RewriteOptionsResponse)
async def rewrite_options(request: RewriteOptionsRequest) -> RewriteOptionsResponse:
    """Provide rewrite options for the selected subtree.
    Uses selectedNodeId to locate the subtree inside the provided Content MathML.
    Falls back to the whole expression if the id is not found.
    """
    try:
        ast = _parse_content_mathml_to_ast(request.contentMathML)
        ast_with_ids = _with_ids(ast)
        target = _find_node_by_id(ast_with_ids, request.selectedNodeId) or ast_with_ids
        expr = _ast_to_sympy(target)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f'Invalid Content MathML: {e}')

    options = _generate_rewrite_options(expr)
    return RewriteOptionsResponse(options=options)


if __name__ == "__main__":
    import sys
    import argparse
    import uvicorn

    parser = argparse.ArgumentParser(
        prog="python main.py",
        description=(
            "Run the Math Expression Rewriting API server.\n\n"
            "Examples:\n"
            "  python main.py serve --host 0.0.0.0 --port 8000 --reload\n"
            "  python -m uvicorn main:app --reload\n"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "command",
        nargs="?",
        help="Command to execute. Use 'serve' to start the API server.",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Host address (default: 0.0.0.0)")
    parser.add_argument("--port", type=int, default=8000, help="Port number (default: 8000)")
    parser.add_argument("--reload", action="store_true", help="Enable auto-reload (development)")

    args = parser.parse_args()

    # If run with no arguments, print usage and exit without starting the server
    if args.command is None:
        print("Usage: python main.py serve [--host HOST] [--port PORT] [--reload]")
        print("Alternative: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        sys.exit(0)

    if args.command in {"serve", "run", "start"}:
        uvicorn.run(app, host=args.host, port=args.port, reload=args.reload)
    else:
        print(f"Unknown command: {args.command}")
        print("Use: python main.py serve [--host HOST] [--port PORT] [--reload]")
        sys.exit(1)