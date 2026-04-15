package applog

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/mattn/go-isatty"
)

// 与 github.com/gin-gonic/gin/logger.go 默认 Logger 一致的 ANSI（背景色块）
const (
	ginGreen   = "\033[97;42m"
	ginWhite   = "\033[90;47m"
	ginYellow  = "\033[90;43m"
	ginRed     = "\033[97;41m"
	ginBlue    = "\033[97;44m"
	ginMagenta = "\033[97;45m"
	ginCyan    = "\033[97;46m"
	ginReset   = "\033[0m"
)

func ginUseColor() bool {
	if os.Getenv("NO_COLOR") != "" || os.Getenv("TERM") == "dumb" {
		return false
	}
	return isatty.IsTerminal(os.Stdout.Fd())
}

func ginStatusColor(code int) string {
	switch {
	case code >= http.StatusContinue && code < http.StatusOK:
		return ginWhite
	case code >= http.StatusOK && code < http.StatusMultipleChoices:
		return ginGreen
	case code >= http.StatusMultipleChoices && code < http.StatusBadRequest:
		return ginWhite
	case code >= http.StatusBadRequest && code < http.StatusInternalServerError:
		return ginYellow
	default:
		return ginRed
	}
}

func ginMethodColor(method string) string {
	switch method {
	case http.MethodGet:
		return ginBlue
	case http.MethodPost:
		return ginCyan
	case http.MethodPut:
		return ginYellow
	case http.MethodDelete:
		return ginRed
	case http.MethodPatch:
		return ginGreen
	case http.MethodHead:
		return ginMagenta
	case http.MethodOptions:
		return ginWhite
	default:
		return ginReset
	}
}

func ginLatencyColor(d time.Duration) string {
	switch {
	case d < time.Millisecond*100:
		return ginWhite
	case d < time.Millisecond*200:
		return ginGreen
	case d < time.Millisecond*300:
		return ginCyan
	case d < time.Millisecond*500:
		return ginBlue
	case d < time.Second:
		return ginYellow
	case d < time.Second*2:
		return ginMagenta
	default:
		return ginRed
	}
}

func ginSlogLevelColor(level slog.Level) string {
	switch {
	case level >= slog.LevelError:
		return ginRed
	case level >= slog.LevelWarn:
		return ginYellow
	case level >= slog.LevelInfo:
		return ginCyan
	default:
		return ginWhite
	}
}

func truncateLatency(d time.Duration) time.Duration {
	switch {
	case d > time.Minute:
		return d.Truncate(time.Second * 10)
	case d > time.Second:
		return d.Truncate(time.Millisecond * 10)
	case d > time.Millisecond:
		return d.Truncate(time.Microsecond * 10)
	default:
		return d
	}
}

// ginStyleHandler：业务/GORM 日志行风格对齐 Gin 默认 Logger（时间格式、色块习惯）
type ginStyleHandler struct {
	opts  slog.HandlerOptions
	mu    sync.Mutex
	w     io.Writer
	attrs []slog.Attr
}

func newGinStyleHandler(w io.Writer, opts *slog.HandlerOptions) *ginStyleHandler {
	if opts == nil {
		opts = &slog.HandlerOptions{}
	}
	return &ginStyleHandler{w: w, opts: *opts}
}

func (h *ginStyleHandler) Enabled(_ context.Context, level slog.Level) bool {
	min := slog.LevelInfo
	if h.opts.Level != nil {
		min = h.opts.Level.Level()
	}
	return level >= min
}

func (h *ginStyleHandler) Handle(_ context.Context, r slog.Record) error {
	color := ginUseColor()
	ts := r.Time.Local().Format("2006/01/02 - 15:04:05")

	component := "app"
	var restAttrs []slog.Attr
	collect := append(append([]slog.Attr{}, h.attrs...), collectRecordAttrs(r)...)
	for _, a := range collect {
		if a.Key == "component" && a.Value.Kind() == slog.KindString {
			if s := a.Value.String(); s != "" {
				component = s
			}
			continue
		}
		restAttrs = append(restAttrs, a)
	}

	var buf strings.Builder
	fmt.Fprintf(&buf, "[%s] %s | ", component, ts)

	lv := r.Level.String()
	if color {
		fmt.Fprintf(&buf, "%s%s%s | ", ginSlogLevelColor(r.Level), lv, ginReset)
	} else {
		fmt.Fprintf(&buf, "%s | ", lv)
	}

	if r.Message != "" {
		buf.WriteByte(' ')
		buf.WriteString(r.Message)
	}

	for _, a := range restAttrs {
		h.formatAttr(&buf, a, color)
	}

	buf.WriteByte('\n')

	h.mu.Lock()
	defer h.mu.Unlock()
	_, err := h.w.Write([]byte(buf.String()))
	return err
}

func collectRecordAttrs(r slog.Record) []slog.Attr {
	var out []slog.Attr
	r.Attrs(func(a slog.Attr) bool {
		out = append(out, a)
		return true
	})
	return out
}

func (h *ginStyleHandler) formatAttr(buf *strings.Builder, a slog.Attr, color bool) {
	if a.Equal(slog.Attr{}) {
		return
	}
	switch a.Value.Kind() {
	case slog.KindGroup:
		for _, sub := range a.Value.Group() {
			h.formatAttr(buf, sub, color)
		}
		return
	default:
		key := a.Key
		if key == slog.TimeKey {
			return
		}
		buf.WriteByte(' ')
		buf.WriteString(key)
		buf.WriteByte('=')

		if key == "latency" && a.Value.Kind() == slog.KindDuration {
			d := truncateLatency(a.Value.Duration())
			if color {
				fmt.Fprintf(buf, "%s%v%s", ginLatencyColor(d), d, ginReset)
			} else {
				buf.WriteString(d.String())
			}
			return
		}

		valStr := stringifyValue(a.Value)
		if !color {
			buf.WriteString(valStr)
			return
		}

		switch key {
		case "method":
			fmt.Fprintf(buf, "%s%s%s", ginMethodColor(valStr), valStr, ginReset)
		case "status":
			if code, err := strconv.Atoi(valStr); err == nil {
				fmt.Fprintf(buf, "%s%d%s", ginStatusColor(code), code, ginReset)
			} else {
				buf.WriteString(valStr)
			}
		default:
			buf.WriteString(valStr)
		}
	}
}

func stringifyValue(v slog.Value) string {
	switch v.Kind() {
	case slog.KindString:
		return v.String()
	case slog.KindInt64:
		return strconv.FormatInt(v.Int64(), 10)
	case slog.KindUint64:
		return strconv.FormatUint(v.Uint64(), 10)
	case slog.KindFloat64:
		return strconv.FormatFloat(v.Float64(), 'g', -1, 64)
	case slog.KindBool:
		return strconv.FormatBool(v.Bool())
	case slog.KindDuration:
		return v.Duration().String()
	case slog.KindTime:
		return v.Time().Format(time.RFC3339)
	default:
		return v.String()
	}
}

func (h *ginStyleHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	n := *h
	n.attrs = append(append([]slog.Attr{}, h.attrs...), attrs...)
	return &n
}

func (h *ginStyleHandler) WithGroup(name string) slog.Handler {
	return h
}
