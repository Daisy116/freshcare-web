/** Native OOXML column chart for the report's second worksheet.
 * ExcelJS 4.x has no chart writer. Keep cell creation in ExcelJS and add only
 * the chart/drawing relationships to the finished XLSX (an Open XML ZIP).
 * Structure: https://learn.microsoft.com/en-us/office/open-xml/spreadsheet/how-to-insert-a-chart-into-a-spreadsheet
 */
const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
const relationshipsNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships'
const documentRelationships = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const drawingNamespace = 'http://schemas.openxmlformats.org/drawingml/2006'
const escapeXml = (value: string) => value.replace(/[<>&"']/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[character]!)

export async function addStatusChart(data: ArrayBuffer, statuses: Array<{ label: string; count: number }>): Promise<ArrayBuffer> {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(data)
  const labels = statuses.map((status, index) => `<c:pt idx="${index}"><c:v>${escapeXml(status.label)}</c:v></c:pt>`).join('')
  const values = statuses.map((status, index) => `<c:pt idx="${index}"><c:v>${status.count}</c:v></c:pt>`).join('')
  const chart = `${xmlDeclaration}
<c:chartSpace xmlns:c="${drawingNamespace}/chart" xmlns:a="${drawingNamespace}/main" xmlns:r="${documentRelationships}">
 <c:lang val="zh-TW"/>
 <c:chart>
  <c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="zh-TW"/><a:t>工單狀態分布（件數）</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title>
  <c:autoTitleDeleted val="0"/>
  <c:plotArea><c:layout/>
   <c:barChart><c:barDir val="col"/><c:grouping val="clustered"/><c:varyColors val="0"/>
    <c:ser><c:idx val="0"/><c:order val="0"/><c:tx><c:v>工單件數</c:v></c:tx>
     <c:spPr><a:solidFill><a:srgbClr val="315339"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
     <c:cat><c:strRef><c:f>'工單狀態分析'!$A$7:$A$11</c:f><c:strCache><c:ptCount val="5"/>${labels}</c:strCache></c:strRef></c:cat>
     <c:val><c:numRef><c:f>'工單狀態分析'!$B$7:$B$11</c:f><c:numCache><c:formatCode>0</c:formatCode><c:ptCount val="5"/>${values}</c:numCache></c:numRef></c:val>
    </c:ser>
    <c:dLbls><c:dLblPos val="outEnd"/><c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/></c:dLbls>
    <c:gapWidth val="100"/><c:axId val="100"/><c:axId val="200"/>
   </c:barChart>
   <c:catAx><c:axId val="100"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="200"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx>
   <c:valAx><c:axId val="200"/><c:scaling><c:orientation val="minMax"/><c:min val="0"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="100"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>
  </c:plotArea>
  <c:plotVisOnly val="1"/><c:dispBlanksAs val="zero"/><c:showDLblsOverMax val="0"/>
 </c:chart>
 <c:spPr><a:solidFill><a:srgbClr val="E9F7EB"/></a:solidFill><a:ln><a:noFill/></a:ln></c:spPr>
</c:chartSpace>`
  zip.file('xl/charts/chart1.xml', chart)
  zip.file('xl/drawings/drawing1.xml', `${xmlDeclaration}
<xdr:wsDr xmlns:xdr="${drawingNamespace}/spreadsheetDrawing" xmlns:a="${drawingNamespace}/main">
 <xdr:twoCellAnchor>
  <xdr:from><xdr:col>4</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>5</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
  <xdr:to><xdr:col>12</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>21</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
  <xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="1" name="工單狀態分布"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>
   <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
   <a:graphic><a:graphicData uri="${drawingNamespace}/chart"><c:chart xmlns:c="${drawingNamespace}/chart" xmlns:r="${documentRelationships}" r:id="rId1"/></a:graphicData></a:graphic>
  </xdr:graphicFrame><xdr:clientData/>
 </xdr:twoCellAnchor>
</xdr:wsDr>`)
  zip.file('xl/drawings/_rels/drawing1.xml.rels', `${xmlDeclaration}<Relationships xmlns="${relationshipsNamespace}"><Relationship Id="rId1" Type="${documentRelationships}/chart" Target="../charts/chart1.xml"/></Relationships>`)
  const sheetPath = 'xl/worksheets/sheet2.xml'
  const sheet = await zip.file(sheetPath)!.async('string')
  zip.file(sheetPath, sheet.replace('</worksheet>', '<drawing r:id="rIdStatusChart"/></worksheet>'))
  const sheetRelsPath = 'xl/worksheets/_rels/sheet2.xml.rels'
  const sheetRels = await zip.file(sheetRelsPath)?.async('string') ?? `${xmlDeclaration}<Relationships xmlns="${relationshipsNamespace}"></Relationships>`
  zip.file(sheetRelsPath, sheetRels.replace('</Relationships>', `<Relationship Id="rIdStatusChart" Type="${documentRelationships}/drawing" Target="../drawings/drawing1.xml"/></Relationships>`))
  const contentTypes = await zip.file('[Content_Types].xml')!.async('string')
  zip.file('[Content_Types].xml', contentTypes.replace('</Types>', '<Override PartName="/xl/charts/chart1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/><Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>'))
  return zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' })
}
