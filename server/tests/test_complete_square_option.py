from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def test_complete_square_option_present():
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
    assert any(o.get('ruleName') == 'complete_square' for o in opts), opts
