import { Product, Warehouse, Supplier, Payable, Customer, Receivable } from './api';
export declare function useProducts(q?: string): import("@tanstack/react-query").UseQueryResult<Product[], Error>;
export declare function useCreateProduct(): import("@tanstack/react-query").UseMutationResult<Product, Error, {
    sku: string;
    name: string;
    unit?: string | undefined;
    price: number;
    ncm?: string | undefined;
    cfop?: string | undefined;
}, unknown>;
export declare function useProduct(id?: string): import("@tanstack/react-query").UseQueryResult<Product, Error>;
export declare function useUpdateProduct(id: string): import("@tanstack/react-query").UseMutationResult<Product, Error, {
    sku?: string | undefined;
    name?: string | undefined;
    unit?: string | undefined;
    price?: number | undefined;
    ncm?: string | undefined;
    cfop?: string | undefined;
}, unknown>;
export declare function useWarehouses(): import("@tanstack/react-query").UseQueryResult<Warehouse[], Error>;
export declare function useCreateWarehouse(): import("@tanstack/react-query").UseMutationResult<Warehouse, Error, {
    name: string;
    code: string;
}, unknown>;
export declare function useStockBalance(params: {
    warehouseId?: string;
    sku?: string;
    productId?: string;
    ownership?: 'own' | 'third_party_in' | 'third_party_out';
    supplierId?: string;
    customerId?: string;
}): import("@tanstack/react-query").UseQueryResult<{
    productId: string;
    sku: string | null;
    productName: string | null;
    unit: string | null;
    warehouseId: string;
    warehouseCode: string | null;
    warehouseName: string | null;
    ownership: 'own' | 'third_party_in' | 'third_party_out';
    supplierId: string | null;
    customerId: string | null;
    ownerLabel: string | null;
    onHand: number;
}[], Error>;
export declare function useStockIn(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    warehouseId: string;
    productId: string;
    quantity: number;
    note?: string | undefined;
}, unknown>;
export declare function useStockOut(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    warehouseId: string;
    productId: string;
    quantity: number;
    note?: string | undefined;
}, unknown>;
export declare function useStockTransfer(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    fromWarehouseId: string;
    toWarehouseId: string;
    productId: string;
    quantity: number;
    note?: string | undefined;
}, unknown>;
export declare function useSuppliers(q?: string): import("@tanstack/react-query").UseQueryResult<Supplier[], Error>;
export declare function useSupplier(id?: string): import("@tanstack/react-query").UseQueryResult<Supplier, Error>;
export declare function useCreateSupplier(): import("@tanstack/react-query").UseMutationResult<Supplier, Error, {
    docType: 'CNPJ' | 'CPF' | string;
    document: string;
    name: string;
    email?: string | undefined;
    phone?: string | undefined;
}, unknown>;
export declare function useUpdateSupplier(id: string): import("@tanstack/react-query").UseMutationResult<Supplier, Error, Partial<{
    docType: 'CNPJ' | 'CPF' | string;
    document: string;
    name: string;
    email: string;
    phone: string;
}>, unknown>;
export declare function useDeleteSupplier(): import("@tanstack/react-query").UseMutationResult<void, Error, string, unknown>;
export declare function usePayables(params: {
    status?: 'open' | 'paid' | 'canceled';
    supplierId?: string;
    from?: string;
    to?: string;
    q?: string;
}): import("@tanstack/react-query").UseQueryResult<Payable[], Error>;
export declare function useCreatePayable(): import("@tanstack/react-query").UseMutationResult<Payable, Error, {
    supplierId: string;
    dueDate: string;
    amount: number;
    paymentMethod: string;
    nfeReceivedId?: string | undefined;
}, unknown>;
export declare function usePayable(id?: string): import("@tanstack/react-query").UseQueryResult<Payable, Error>;
export declare function useAddPayablePayment(): import("@tanstack/react-query").UseMutationResult<any, Error, {
    id: string;
    paidAt?: string | undefined;
    amount?: number | undefined;
    method?: string | undefined;
    reference?: string | undefined;
    note?: string | undefined;
}, unknown>;
export declare function useCancelPayable(): import("@tanstack/react-query").UseMutationResult<Payable, Error, string, unknown>;
export declare function useReceivables(params: {
    status?: 'open' | 'paid' | 'canceled';
    customerId?: string;
    from?: string;
    to?: string;
    q?: string;
}): import("@tanstack/react-query").UseQueryResult<Receivable[], Error>;
export declare function useCreateReceivable(): import("@tanstack/react-query").UseMutationResult<Receivable, Error, {
    customerId: string;
    dueDate: string;
    amount: number | string;
    method?: string | undefined;
    nfeId?: string | undefined;
}, unknown>;
export declare function useReceivable(id?: string): import("@tanstack/react-query").UseQueryResult<Receivable, Error>;
export declare function useAddReceivablePayment(): import("@tanstack/react-query").UseMutationResult<Receivable, Error, {
    id: string;
    paidAt?: string | undefined;
    amount: number;
    method?: string | undefined;
    reference?: string | undefined;
    note?: string | undefined;
}, unknown>;
export declare function useCancelReceivable(): import("@tanstack/react-query").UseMutationResult<Receivable, Error, string, unknown>;
export type ReceivablePayment = {
    id: string;
    receivableId: string;
    paidAt: string;
    amount: string;
    method?: string | null;
    reference?: string | null;
    note?: string | null;
    createdAt: string;
};
export declare function useReceivablePayments(id?: string): import("@tanstack/react-query").UseQueryResult<ReceivablePayment[], Error>;
export declare function useCustomers(params?: {
    q?: string;
}): import("@tanstack/react-query").UseQueryResult<Customer[], Error>;
export declare function useCustomer(id?: string): import("@tanstack/react-query").UseQueryResult<Customer, Error>;
export declare function useCreateCustomer(): import("@tanstack/react-query").UseMutationResult<Customer, Error, Omit<Customer, "id" | "createdAt">, unknown>;
export declare function useUpdateCustomer(): import("@tanstack/react-query").UseMutationResult<Customer, Error, Partial<Customer> & {
    id: string;
}, unknown>;
export declare function useDeleteCustomer(): import("@tanstack/react-query").UseMutationResult<any, Error, string, unknown>;
