import { Controller, Get, Post, Body, Query, Param, BadRequestException, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { StockService } from './stock.service'
import { StockBalanceQueryDto } from './dto/stock-balance.dto'
import { StockInDto, StockOutDto, StockTransferDto } from './dto/stock-move.dto'
import { StockConvertUnitDto } from './dto/stock-convert-unit.dto'


@Controller('inventory/stock')
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('balance')
  getBalance(@Query() q: StockBalanceQueryDto) {
    return this.stockService.getBalance(q)
  }
  
  
  @Get('history')
  getHistoryList(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.stockService.getProcessHistoryList({ tenantId, companyId })
  }
@Get(':productId/history')
getHistory(
  @Param('productId') productId: string,
  @Query('tenantId') tenantId: string,
  @Query('companyId') companyId: string,
) {
  return this.stockService.getProcessHistory({
    tenantId,
    companyId,
    productId,
  })
}


// E.1: Upload de foto do romaneio de entrada
  @Post('upload-receipt')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (_req, file, cb) => {
        const ext = file.originalname.split('.').pop()
        cb(null, `receipt-${Date.now()}.${ext}`)
      },
    }),
    fileFilter: (_req, file, cb) => {
      cb(null, /^image\/(jpeg|jpg|png|webp)/.test(file.mimetype))
    },
  }))
  uploadReceipt(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Nenhuma imagem recebida.')
    return { imagePath: file.filename }
  }

@Post('move')
move(@Body() dto: any) {
  if (dto.type === 'in') {
    return this.stockService.stockIn(dto)
  }

  if (dto.type === 'out') {
    return this.stockService.stockOut(dto)
  }

  throw new BadRequestException('Tipo de movimentação inválido')
}


  @Post('transfer')
  transfer(@Body() dto: StockTransferDto) {
    return this.stockService.transfer(dto)
  }
  
  @Post('convert-unit')
  convertUnit(@Body() dto: StockConvertUnitDto) {
	    console.log('DTO RECEBIDO:', dto)
	return this.stockService.convertUnit(dto)
}

  @Get('warehouses')
  async listWarehouses(
    @Query('tenantId') tenantId: string,
    @Query('companyId') companyId: string,
  ) {
    return this.stockService.listWarehouses({ tenantId, companyId })
  }

}
