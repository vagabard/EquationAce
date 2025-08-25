from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def test_complete_square_option_has_parentheses_in_power_base():
    # x^2 + 6x + 5 -> (x+3)^2 - 4; ensure (x+3) is parenthesized in msup base
    content = wrap(
        '<apply><plus/>'
        '<apply><power/><ci>x</ci><cn>2</cn></apply>'
        '<apply><times/><cn>6</cn><ci>x</ci></apply>'
        '<cn>5</cn>'
        '</apply>'
    )
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    cs = [o for o in opts if o.get('ruleName') == 'complete_square']
    assert cs, opts
    # Check that presentation MathML has parentheses immediately in the msup base
    # Expect structure like: <msup><mrow><mo>(</mo> ... <mo>)</mo></mrow><mn>2</mn></msup>
    assert any('<msup><mrow><mo>(</mo>' in (o.get('replacementPresentationMathML') or '') for o in cs), cs
