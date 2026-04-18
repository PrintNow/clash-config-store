package util

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"sync"
	"time"
)

const (
	rsaKeyBits    = 2048
	rsaKeyTTL     = 24 * time.Hour // 公钥有效期
)

// rsaKeyPair 当前活跃密钥对
type rsaKeyPair struct {
	private   *rsa.PrivateKey
	publicPEM string
	expiresAt time.Time
}

var (
	rsaMu      sync.RWMutex
	currentKey *rsaKeyPair
)

// InitRSA 在服务启动时生成初始密钥对
func InitRSA() error {
	_, err := rotateRSAKey()
	return err
}

// rotateRSAKey 生成新密钥对并替换当前密钥
func rotateRSAKey() (*rsaKeyPair, error) {
	priv, err := rsa.GenerateKey(rand.Reader, rsaKeyBits)
	if err != nil {
		return nil, err
	}

	pubDER, err := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	if err != nil {
		return nil, err
	}

	pubPEM := string(pem.EncodeToMemory(&pem.Block{
		Type:  "PUBLIC KEY",
		Bytes: pubDER,
	}))

	kp := &rsaKeyPair{
		private:   priv,
		publicPEM: pubPEM,
		expiresAt: time.Now().Add(rsaKeyTTL),
	}

	rsaMu.Lock()
	currentKey = kp
	rsaMu.Unlock()

	return kp, nil
}

// GetRSAPublicKey 返回当前公钥 PEM 和过期时间；若密钥已过期则自动轮换
func GetRSAPublicKey() (publicPEM string, expiresAt time.Time, err error) {
	rsaMu.RLock()
	kp := currentKey
	rsaMu.RUnlock()

	if kp == nil || time.Now().After(kp.expiresAt) {
		kp, err = rotateRSAKey()
		if err != nil {
			return "", time.Time{}, err
		}
	}

	return kp.publicPEM, kp.expiresAt, nil
}

// RSADecrypt 用当前私钥解密前端传来的 RSA-OAEP(SHA-256) 密文（base64 标准编码）
func RSADecrypt(ciphertext []byte) ([]byte, error) {
	rsaMu.RLock()
	kp := currentKey
	rsaMu.RUnlock()

	if kp == nil {
		return nil, errors.New("RSA key not initialized")
	}

	plaintext, err := rsa.DecryptOAEP(sha256.New(), rand.Reader, kp.private, ciphertext, nil)
	if err != nil {
		return nil, errors.New("RSA decrypt failed: " + err.Error())
	}
	return plaintext, nil
}
