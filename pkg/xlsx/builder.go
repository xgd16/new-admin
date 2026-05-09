package xlsx

import (
	"errors"
	"fmt"
	"strings"

	"github.com/xuri/excelize/v2"
)

const (
	colWidthMin = 8.0
	colWidthMax = 60.0
)

// Builder 将二维表数据写入单个工作表，用于导出 .xlsx。
type Builder struct {
	file   *excelize.File
	sheet  string
	next   int
	colMax []float64
}

// NewBuilder 创建工作簿；sheetName 为空时使用默认工作表名 Sheet1，否则新建并删除默认表。
func NewBuilder(sheetName string) (*Builder, error) {
	f := excelize.NewFile()
	s := strings.TrimSpace(sheetName)
	if s == "" {
		s = "Sheet1"
	}
	if s != "Sheet1" {
		if _, err := f.NewSheet(s); err != nil {
			_ = f.Close()
			return nil, err
		}
		if err := f.DeleteSheet("Sheet1"); err != nil {
			_ = f.Close()
			return nil, err
		}
	}
	return &Builder{file: f, sheet: s, next: 1}, nil
}

func estimateCellDisplayWidth(v any) float64 {
	if v == nil {
		return colWidthMin
	}
	var s string
	switch t := v.(type) {
	case string:
		s = t
	case fmt.Stringer:
		s = t.String()
	default:
		s = fmt.Sprint(v)
	}
	if s == "" {
		return colWidthMin
	}
	var w float64
	for _, r := range s {
		if r == '\r' {
			continue
		}
		if r == '\n' {
			continue
		}
		if r < 0x0080 {
			w += 1
		} else {
			w += 2
		}
	}
	w += 2
	if w < colWidthMin {
		w = colWidthMin
	}
	if w > colWidthMax {
		w = colWidthMax
	}
	return w
}

func (b *Builder) noteColumnWidths(cells []any) {
	for i := range cells {
		w := estimateCellDisplayWidth(cells[i])
		if i >= len(b.colMax) {
			b.colMax = append(b.colMax, w)
		} else if w > b.colMax[i] {
			b.colMax[i] = w
		}
	}
}

func (b *Builder) applyColumnWidths() error {
	if b.file == nil {
		return nil
	}
	for i, w := range b.colMax {
		colW := w
		if colW <= 0 {
			colW = colWidthMin
		}
		col, err := excelize.ColumnNumberToName(i + 1)
		if err != nil {
			return err
		}
		if err := b.file.SetColWidth(b.sheet, col, col, colW); err != nil {
			return err
		}
	}
	return nil
}

// AppendRow 在下一行写入一组单元格（自第 A 列起）。
func (b *Builder) AppendRow(cells []any) error {
	if b == nil || b.file == nil {
		return errors.New("xlsx: nil builder")
	}
	cellName, err := excelize.CoordinatesToCellName(1, b.next)
	if err != nil {
		return err
	}
	row := make([]any, len(cells))
	copy(row, cells)
	b.noteColumnWidths(row)
	if err := b.file.SetSheetRow(b.sheet, cellName, &row); err != nil {
		return err
	}
	b.next++
	return nil
}

// Bytes 将工作簿序列化为内存并重置内部文件句柄（之后不可再写入）。
func (b *Builder) Bytes() ([]byte, error) {
	if b == nil || b.file == nil {
		return nil, errors.New("xlsx: nil builder")
	}
	defer func() {
		_ = b.file.Close()
		b.file = nil
	}()
	if err := b.applyColumnWidths(); err != nil {
		return nil, err
	}
	buf, err := b.file.WriteToBuffer()
	if err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}
