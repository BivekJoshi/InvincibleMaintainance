import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetCustomerRecordsQuery } from '@/api/customersApi';
import { CustomTable } from '@/components/common/CustomTable/CustomTable';

/** One domain's records for this customer (quotations, jobs, …), from that domain's list endpoint. */
export function CustomerRecordsTab({ customerId, tab }) {
  const navigate = useNavigate();
  const [params, setParams] = useState({ page: 1, limit: 10 });
  const { data, isLoading, isFetching, error, refetch } = useGetCustomerRecordsQuery({ kind: tab.kind, customerId, params });

  return (
    <CustomTable
      columns={tab.columns}
      data={data?.items}
      meta={data?.meta}
      params={params}
      onParamsChange={setParams}
      searchable={false}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      refetch={refetch}
      onRowClick={tab.href ? (row) => navigate(tab.href(row)) : undefined}
      emptyTitle={tab.emptyTitle}
      pageSizes={[10, 20, 50]}
    />
  );
}
