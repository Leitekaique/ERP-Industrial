import { Body, Controller, Delete, Get, Param, Post, Put, Query, Res, NotFoundException, BadRequestException, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { Response } from 'express'
import * as fs from 'fs'
import * as path from 'path'
import { NfeEmitService } from './nfe-emit.service'
import { IbptService } from './ibpt.service'
import { EmitNfeDto } from './dto/emit-nfe.dto'
import { CancelNfeDto } from './dto/cancel-nfe.dto'
import { StatusNfeDto } from './dto/status-nfe.dto'
import { CreateDraftFromStockDto } from './dto/create-draft-from-stock.dto'
import { DEFAULT_TENANT_ID, DEFAULT_COMPANY_ID } from '../../common/constants/tenant-company.constants'
import { Public } from '../auth/decorators/public.decorator'


@Controller('nfe-emit')
export class NfeEmitController {
  constructor(
    private readonly nfeService: NfeEmitService,
    private readonly ibptService: IbptService,
  ) {}
  
  // a31 — Importar XML de NF histórica (já autorizada)
  @Post('import-xml')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
    }),
  }))
  async importXml(
    @UploadedFile() file: Express.Multer.File,
    @Body('tenantId') tenantId?: string,
    @Body('companyId') companyId?: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo recebido.')
    return this.nfeService.importHistoricalXml(
      file,
      tenantId || DEFAULT_TENANT_ID,
      companyId || DEFAULT_COMPANY_ID,
    )
  }

  @Post('preview-from-stock')
  async previewFromStock(
    @Body() dto: { tenantId: string; companyId: string; stockLotIds: string[] }
  ) {
    return this.nfeService.previewFromStock(dto)
  }
  @Post('create-draft')
  async createDraft(@Body() dto: CreateDraftFromStockDto) {
	return this.nfeService.createDraftFromStock(dto)
  }

  @Get()
  async list(@Query() q: any) {
    return this.nfeService.listNfe(q)
  }

  @Public()
  @Get(':id/danfe')
  async danfe(
    @Param('id') id: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const pdfBuffer = await this.nfeService.getDanfePdf(id, q)
    if (!pdfBuffer) throw new NotFoundException('NF não encontrada ou dados insuficientes para gerar DANFE')
    const nfe = await this.nfeService.getNfe(id, q)
    const series = String(nfe?.series ?? 1).padStart(3, '0')
    const numStr = String(nfe?.number ?? id).padStart(9, '0')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="NF_${series}_S_${numStr}.pdf"`)
    res.send(pdfBuffer)
  }

  @Get(':id/xml')
  async downloadXml(
    @Param('id') id: string,
    @Query() q: any,
    @Res() res: Response,
  ) {
    const result = await this.nfeService.getXmlContent(id, q)
    if (!result) throw new NotFoundException('XML não disponível para esta NF')
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.send(result.content)
  }

  @Get('next-number')
  async nextNumber(@Query('tenantId') tenantId?: string, @Query('companyId') companyId?: string) {
    return this.nfeService.getNextNfeNumber(
      tenantId || DEFAULT_TENANT_ID,
      companyId || DEFAULT_COMPANY_ID,
    )
  }

  @Get(':id')
  async getOne(@Param('id') id: string, @Query() q: any) {
    return this.nfeService.getNfe(id, q)
  }

  @Post(':id/emit')
  async emitFromDraft(
    @Param('id') id: string,
    @Body() dto: { tenantId: string; companyId: string; naturezaOperacao?: string; transportadoraNome?: string; transportadoraCnpj?: string; freightType?: string; vehiclePlate?: string; vehicleUf?: string; volumesQty?: string; volumesSpecies?: string; volumesBrand?: string; weightNet?: string; weightGross?: string; refNFe?: string },
  ) {
    return this.nfeService.emitFromDraft(id, dto)
  }

  // ====== mantém seu legado/simulador atual (não quebra) ======
  @Post('emit')
  async emitir(@Body() dto: EmitNfeDto) {
    return this.nfeService.emitNfe(dto)
  }

  @Post('cancel')
  async cancelar(@Body() dto: CancelNfeDto) {
    return this.nfeService.cancelNfe(dto)
  }

  @Post('status')
  async status(@Body() dto: StatusNfeDto) {
    return this.nfeService.statusNfe(dto)
  }

  @Delete(':id')
  async deleteDraft(@Param('id') id: string) {
    return this.nfeService.deleteDraft(id)
  }

  @Post(':id/cancel')
  async cancelById(
    @Param('id') id: string,
    @Body('justificativa') justificativa?: string,
  ) {
    return this.nfeService.cancelNfeById(id, justificativa)
  }

  @Post(':id/cce')
  async emitirCCe(
    @Param('id') id: string,
    @Body('xCorrecao') xCorrecao: string,
  ) {
    if (!xCorrecao) throw new BadRequestException('xCorrecao é obrigatório.')
    return this.nfeService.emitirCCe(id, xCorrecao)
  }

  @Get(':id/eventos')
  async listEventos(@Param('id') id: string) {
    return this.nfeService.listEventos(id)
  }

  @Get('eventos/:eventoId/xml')
  async downloadEventoXml(
    @Param('eventoId') eventoId: string,
    @Res() res: Response,
  ) {
    const result = await this.nfeService.getEventoXml(eventoId)
    if (!result) throw new NotFoundException('XML do evento não encontrado.')
    res.setHeader('Content-Type', 'application/xml; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.send(result.content)
  }

  @Get('eventos/:eventoId/pdf')
  async downloadEventoPdf(
    @Param('eventoId') eventoId: string,
    @Res() res: Response,
  ) {
    const result = await this.nfeService.getEventoPdf(eventoId)
    if (!result) throw new NotFoundException('PDF do evento não disponível.')
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="${result.filename}"`)
    res.send(result.buffer)
  }

  // ── IBPT — alíquotas de tributos aproximados ───────────────────────────────

  /** Retorna alíquotas IBPT vigentes para a empresa */
  @Get('ibpt-rates')
  async getIbptRates(@Query('companyId') companyId: string) {
    if (!companyId) throw new BadRequestException('companyId obrigatório')
    return this.ibptService.getRates(companyId)
  }

  /** Dispara atualização manual via API IBPT para todas as empresas */
  @Post('ibpt-rates/refresh')
  async refreshIbptRates() {
    await this.ibptService.updateAllCompanies()
    return { ok: true }
  }

  /** Define alíquotas manualmente para uma empresa específica */
  @Put('ibpt-rates/:companyId')
  async setIbptRates(
    @Param('companyId') companyId: string,
    @Body() dto: { federalPct: number; estadualPct: number },
  ) {
    if (!dto.federalPct || !dto.estadualPct) throw new BadRequestException('federalPct e estadualPct são obrigatórios')
    await this.ibptService.setRates(companyId, Number(dto.federalPct), Number(dto.estadualPct))
    return { ok: true, federalPct: dto.federalPct, estadualPct: dto.estadualPct }
  }
}
