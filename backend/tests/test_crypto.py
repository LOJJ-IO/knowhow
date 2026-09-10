from app.security.crypto import decrypt_refresh_token, encrypt_refresh_token


def test_refresh_token_roundtrips_through_encryption():
    plaintext = "1//0gExampleRefreshTokenValue"
    ciphertext = encrypt_refresh_token(plaintext)

    assert ciphertext != plaintext.encode()
    assert decrypt_refresh_token(ciphertext) == plaintext
