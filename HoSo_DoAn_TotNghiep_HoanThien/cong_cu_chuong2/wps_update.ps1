# Mở tệp .docx bằng COM "Word.Application" (trên máy này là WPS Office), cập nhật mục lục
# và số trang của hai danh mục hình/bảng, lưu lại rồi xuất PDF.
# usage: wps_update.ps1 -Docx <path.docx> -Pdf <path.pdf> [-FullToc 1]
param(
  [Parameter(Mandatory = $true)][string]$Docx,
  [Parameter(Mandatory = $true)][string]$Pdf,
  [int]$FullToc = 1
)
if (Test-Path $Pdf) { Remove-Item $Pdf -Force }
$app = New-Object -ComObject Word.Application
$app.Visible = $false
$app.DisplayAlerts = 0
try {
  $doc = $app.Documents.Open($Docx, $false, $false)
  if ($FullToc -eq 1) {
    # Mục lục chính: dựng lại toàn bộ (tiêu đề đã thay đổi)
    $doc.TablesOfContents.Item(1).Update()
    $doc.Repaginate()
  }
  $doc.TablesOfContents.Item(1).UpdatePageNumbers()
  # Danh mục hình/bảng: chỉ cập nhật số trang để giữ nguyên chữ đã làm sạch ở lần trước
  for ($i = 1; $i -le $doc.TablesOfFigures.Count; $i++) { $doc.TablesOfFigures.Item($i).UpdatePageNumbers() }
  $doc.Save()
  $doc.ExportAsFixedFormat($Pdf, 17)
  "pages=" + $doc.ComputeStatistics(2)
  $doc.Close(0)
}
finally {
  try { $app.Quit() } catch { }
  try { [System.Runtime.InteropServices.Marshal]::ReleaseComObject($app) | Out-Null } catch { }
}
