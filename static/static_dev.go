//go:build dev

package static

import (
	"io/fs"
	"os"
)

func GetFS() (fs.FS, error) {
	return os.DirFS("frontend/dist"), nil
}
