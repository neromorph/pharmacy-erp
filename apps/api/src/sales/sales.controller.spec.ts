import { describe, it, expect, beforeEach } from 'vitest'
import { Test } from '@nestjs/testing'
import { SalesController } from './sales.controller'
import { SalesService } from './sales.service'

describe('SalesController', () => {
  let controller: SalesController

  beforeEach(async () => {
    const mod = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [{ provide: SalesService, useValue: {} }],
    }).compile()

    controller = mod.get(SalesController)
  })

  it('exists', () => {
    expect(controller).toBeDefined()
  })
})