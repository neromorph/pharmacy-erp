import { describe, it, expect, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { ProcurementController } from './procurement.controller'
import { ProcurementService } from './procurement.service'

describe('ProcurementController', () => {
  let controller: ProcurementController

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [ProcurementController],
      providers: [{ provide: ProcurementService, useValue: {} }],
    }).compile()

    controller = mod.get(ProcurementController)
  })

  it('exists', () => {
    expect(controller).toBeDefined()
  })
})