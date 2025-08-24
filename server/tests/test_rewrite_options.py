from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(math_core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{math_core}</math>'


def test_rewrite_options_sin_double_angle():
    # sin(2x)
    content = wrap('<apply><sin/><apply><times/><cn>2</cn><ci>x</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={
        'contentMathML': content,
        'selectedNodeId': 'does-not-exist'  # falls back to whole expr
    })
    assert resp.status_code == 200
    data = resp.json()
    opts = data.get('options', [])
    # Expect a double-angle suggestion
    assert any(o.get('ruleName') == 'trig_double_angle_sin' for o in opts), opts


def test_rewrite_options_log_power_pullout():
    # log(a^b)
    content = wrap('<apply><ci>log</ci><apply><power/><ci>a</ci><ci>b</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={
        'contentMathML': content,
        'selectedNodeId': 'does-not-exist'
    })
    assert resp.status_code == 200
    data = resp.json()
    opts = data.get('options', [])
    assert any(o.get('ruleName') == 'log_power_pullout' for o in opts), opts
