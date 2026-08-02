import { Module } from '@nestjs/common';
import { KimiProvider } from './kimi.provider';
import { LLM_PROVIDER } from './llm.provider';

@Module({
  providers: [KimiProvider, { provide: LLM_PROVIDER, useExisting: KimiProvider }],
  exports: [LLM_PROVIDER],
})
export class LlmModule {}
