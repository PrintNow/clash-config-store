//go:build !dev

package static

import (
	"archive/zip"
	"bytes"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

func getAssetsPath() string {
	exe, err := os.Executable()
	if err != nil {
		return "static/assets.zip"
	}
	exeDir := filepath.Dir(exe)
	// 容器：/app/clash-config-store → /app/static/assets.zip；本机：bin/clash-config-store → 仓库根 static/
	candidates := []string{
		filepath.Join(exeDir, "static", "assets.zip"),
		filepath.Join(filepath.Dir(exeDir), "static", "assets.zip"),
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "static/assets.zip"
}

func GetFS() (fs.FS, error) {
	data, err := os.Open(getAssetsPath())
	if err != nil {
		return nil, err
	}

	content, err := io.ReadAll(data)
	data.Close()
	if err != nil {
		return nil, err
	}

	r, err := zip.NewReader(bytes.NewReader(content), int64(len(content)))
	if err != nil {
		return nil, err
	}

	return &zipFS{rc: &zip.ReadCloser{
		Reader: *r,
	}}, nil
}

type zipFile struct {
	*zip.File
	reader io.ReadCloser
}

func (f *zipFile) Stat() (fs.FileInfo, error) {
	return f.File.FileInfo(), nil
}

func (f *zipFile) Read(b []byte) (int, error) {
	if f.reader == nil {
		var err error
		f.reader, err = f.File.Open()
		if err != nil {
			return 0, err
		}
	}
	return f.reader.Read(b)
}

func (f *zipFile) Close() error {
	if f.reader != nil {
		return f.reader.Close()
	}
	return nil
}

type zipFS struct {
	rc *zip.ReadCloser
}

func (z *zipFS) Open(name string) (fs.File, error) {
	name = trimPrefix(name)
	zipPath := "dist/" + name
	for _, f := range z.rc.File {
		if f.Name == zipPath {
			return &zipFile{File: f}, nil
		}
	}
	return nil, fs.ErrNotExist
}

func trimPrefix(name string) string {
	if len(name) > 0 && name[0] == '/' {
		name = name[1:]
	}
	return name
}
