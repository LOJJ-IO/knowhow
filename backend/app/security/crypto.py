from cryptography.fernet import Fernet

from app.config import get_settings


def _fernet() -> Fernet:
    return Fernet(get_settings().token_encryption_key.encode())


def encrypt_refresh_token(plaintext_token: str) -> bytes:
    return _fernet().encrypt(plaintext_token.encode())


def decrypt_refresh_token(ciphertext: bytes) -> str:
    return _fernet().decrypt(ciphertext).decode()
