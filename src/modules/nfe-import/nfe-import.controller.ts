import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  Body,
  Get,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import { NfeImportService } from './nfe-import.service';
import { DEFAULT_TENANT_ID, DEFAULT_COMPANY_ID } from '../../common/constants/tenant-company.constants';

@Controller('nfe-import')
export class NfeImportController {
  constructor(private readonly nfeImportService: NfeImportService) {}

@Get()
  async list() {
    return this.nfeImportService.listNfes();
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads', // 📁 pasta dentro do container (mapeada no docker-compose)
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${file.originalname}`;
        cb(null, uniqueName);
      },
    }),
  }))
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('tenantId') tenantId?: string,
    @Body('companyId') companyId?: string,
  ) {
    if (!file) throw new BadRequestException('Nenhum arquivo recebido.');
    return this.nfeImportService.processXml(
      file,
      tenantId || DEFAULT_TENANT_ID,
      companyId || DEFAULT_COMPANY_ID,
    );
  }
}

