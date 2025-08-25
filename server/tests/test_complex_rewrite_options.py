from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def wrap(core: str) -> str:
    return f'<math xmlns="http://www.w3.org/1998/Math/MathML">{core}</math>'


def test_modulus_square_from_product():
    # z * conjugate(z) should suggest Abs(z)^2
    content = wrap('<apply><times/><ci>z</ci><apply><ci>conjugate</ci><ci>z</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'modulus_square' for o in opts), opts


def test_conjugate_linearity_sum():
    # conjugate(a + b) -> conjugate(a) + conjugate(b)
    content = wrap('<apply><ci>conjugate</ci><apply><plus/><ci>a</ci><ci>b</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'conjugate_linearity' for o in opts), opts


def test_conjugate_multiplicative_product():
    # conjugate(a*b) -> conjugate(a)*conjugate(b)
    content = wrap('<apply><ci>conjugate</ci><apply><times/><ci>a</ci><ci>b</ci></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'conjugate_multiplicative' for o in opts), opts


def test_conjugate_exp_no_assumptions_hidden():
    # Without assumptions, do not offer conj(exp(i*theta)) -> exp(-i*theta)
    content = wrap('<apply><ci>conjugate</ci><apply><ci>exp</ci><apply><times/><ci>i</ci><ci>theta</ci></apply></apply></apply>')
    resp = client.post('/rewriteOptions', json={'contentMathML': content, 'selectedNodeId': 'root'})
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert not any(o.get('ruleName') == 'conjugate_exp_i_theta' for o in opts), opts


def test_conjugate_exp_with_real_theta_shown():
    # With theta real, should offer conj(exp(i*theta)) -> exp(-i*theta)
    content = wrap('<apply><ci>conjugate</ci><apply><ci>exp</ci><apply><times/><ci>I</ci><ci>theta</ci></apply></apply></apply>')
    resp = client.post('/rewriteOptions', json={
        'contentMathML': content,
        'selectedNodeId': 'root',
        'assumptions': {'theta': 'real'}
    })
    assert resp.status_code == 200
    opts = resp.json().get('options', [])
    assert any(o.get('ruleName') == 'conjugate_exp_i_theta' for o in opts), opts
