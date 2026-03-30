const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')
const prisma = new PrismaClient()

async function main() {
  const tenantId = 'T-001'
  const companyId = 'C-001'

  // Tenant
  await prisma.tenant.upsert({
    where: { id: tenantId },
    create: { id: tenantId, name: 'Têxtil Tapajós' },
    update: {},
  })

  // Company
  await prisma.company.upsert({
    where: { id: companyId },
    create: {
      id: companyId,
      tenantId,
      legalName: 'PELETIZAÇÃO TÊXTIL TAPAJOS LTDA',
      tradeName: 'Têxtil Tapajós',
      cnpj: '05114479000100',
	  ie: '606203479118',
	  cnae: '1340-5/99',
	  address: 'RUA GUSTAVO TEIXEIRA, 283',
	  city: 'SANTA BARBARA DOESTE',
	  uf: 'SP',
    },
    update: {},
  })

   // 🔹 Warehouse padrão
  await prisma.warehouse.upsert({
    where: { id: 'W-001' },
    create: {
      id: 'W-001',
      tenantId,
      companyId,
      code: 'DP-01',
      name: 'Depósito Principal',
    },
    update: {},
  })

  // Usuário Admin inicial
  const passwordHash = await bcrypt.hash('tapajos@2025', 10)
  await prisma.user.upsert({
    where: { email: 'admin@tapajos.com.br' },
    create: {
      tenantId,
      companyId,
      email: 'admin@tapajos.com.br',
      passwordHash,
      name: 'Administrador',
      role: 'ADMIN',
    },
    update: {},
  })

  console.log('✅ Seed concluído com sucesso.')
  console.log('👤 Login: admin@tapajos.com.br | Senha: tapajos@2025')
}

main()
  .then(async () => await prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
