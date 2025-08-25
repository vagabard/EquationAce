from fastapi.testclient import TestClient
import sympy as sp
from main import app, _parse_content_mathml_to_sympy

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def pick_diff_option(options):
    for o in options:
        if o.get('ruleName') == 'differentiate':
            return o
    return None


def test_derivative_option_sin_squared():
    # d/dx [ sin(x)^2 ]
    content = wrap(
        '<apply>'
        '<diff/>'
        '<ci>x</ci>'
        '<apply>'
        '<power/>'
        '<apply><sin/><ci>x</ci></apply>'
        '<cn>2</cn>'
        '</apply>'
        '</apply>'
    )

    resp = client.post('/rewriteOptions', json={
        'contentMathML': content,
        'selectedNodeId': 'does-not-exist'
    })
    assert resp.status_code == 200
    data = resp.json()
    opts = data.get('options', [])
    opt = pick_diff_option(opts)
    assert opt is not None, opts

    # Parse the replacement Content MathML and verify it equals 2*sin(x)*cos(x)
    repl_mml = opt['replacementContentMathML']
    expr = _parse_content_mathml_to_sympy(repl_mml)
    x = sp.Symbol('x')
    expected = 2*sp.sin(x)*sp.cos(x)
    assert sp.simplify(expr - expected) == 0


def test_derivative_option_power_rule_symbolic_exponent():
    # d/dx [ x^n ] = n*x^(n-1)
    content = wrap(
        '<apply>'
        '<diff/>'
        '<ci>x</ci>'
        '<apply><power/><ci>x</ci><ci>n</ci></apply>'
        '</apply>'
    )

    resp = client.post('/rewriteOptions', json={
        'contentMathML': content,
        'selectedNodeId': 'does-not-exist'
    })
    assert resp.status_code == 200
    data = resp.json()
    opts = data.get('options', [])
    opt = pick_diff_option(opts)
    assert opt is not None, opts

    repl_mml = opt['replacementContentMathML']
    expr = _parse_content_mathml_to_sympy(repl_mml)
    x = sp.Symbol('x')
    n = sp.Symbol('n')
    expected = n * x**(n-1)
    assert sp.simplify(expr - expected) == 0
