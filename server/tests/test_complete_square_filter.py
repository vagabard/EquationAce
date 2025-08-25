from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def test_complete_square_option_has_no_sqrt_or_I_noise():
    # x^2 + 6x + 5
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
    # Ensure we do have a complete_square option
    cs_opts = [o for o in opts if o.get('ruleName') == 'complete_square']
    assert cs_opts, opts
    # None of the complete_square replacements should contain sqrt or I
    for o in cs_opts:
        cm = (o.get('replacementContentMathML') or '').lower()
        pm = (o.get('replacementPresentationMathML') or '').lower()
        assert 'sqrt' not in cm and 'sqrt' not in pm, o
        assert ' i ' not in cm and ' i ' not in pm and '>i<' not in pm and '>i<' not in cm, o
