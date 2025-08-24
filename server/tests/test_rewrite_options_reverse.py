from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def test_reverse_double_angle_from_product():
    # 2·sin(x)·cos(x) should suggest sin(2x)
    content = wrap('<apply><times/><cn>2</cn><apply><sin/><ci>x</ci></apply><apply><cos/><ci>x</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'trig_double_angle_sin' and 'sin(2x' in o.get('replacementPresentationMathML', '') for o in opts), opts


def test_reverse_sin2_identity_from_one_minus_cos2():
    # 1 - cos(x)^2 should suggest sin(x)^2
    content = wrap('<apply><plus/><cn>1</cn><apply><times/><cn>-1</cn><apply><power/><apply><cos/><ci>x</ci></apply><cn>2</cn></apply></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'trig_identity_sin2' for o in opts), opts


def test_reverse_two_a_to_a_plus_a():
    # 2a should suggest a + a
    content = wrap('<apply><times/><cn>2</cn><ci>a</ci></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'combine_like_terms_add' for o in opts), opts


def test_reverse_combine_exponents_split_sum():
    # x^(a+b) should suggest x^a · x^b
    content = wrap('<apply><power/><ci>x</ci><apply><plus/><ci>a</ci><ci>b</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'combine_exponents' for o in opts), opts


def test_reverse_log_power_pullout_from_b_log_a():
    # b·log(a) should suggest log(a^b)
    content = wrap('<apply><times/><ci>b</ci><apply><ci>log</ci><ci>a</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'log_power_pullout' for o in opts), opts
