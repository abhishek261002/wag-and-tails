import React from 'react';
import { InsuranceRequestsPanel } from '@wag/ui-web';
import { wagApi } from '../lib/api';

export default function InsurancePage() {
  return <InsuranceRequestsPanel api={wagApi.client} />;
}
