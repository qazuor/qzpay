import { useEffect, useState } from 'react';
import { Edit2, ShoppingBag, Plus, Trash2, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCatalogStore, type ProductDefinition } from '../../stores/catalog.store';
import { useConfigStore } from '../../stores/config.store';
import { PageHeader } from '../../components/ui/PageHeader';
import { EmptyState } from '../../components/ui/EmptyState';
import type { QZPayCurrency } from '@qazuor/qzpay-core';

interface ProductFormData {
  name: string;
  description: string;
  unitAmount: number;
  currency: QZPayCurrency;
  active: boolean;
}

const emptyForm: ProductFormData = {
  name: '',
  description: '',
  unitAmount: 0,
  currency: 'USD',
  active: true,
};

const CURRENCIES: QZPayCurrency[] = ['USD', 'EUR', 'GBP', 'ARS', 'BRL', 'MXN'];

export function ProductsView() {
  const { t } = useTranslation('catalog');
  const { t: tc } = useTranslation('common');
  const { isInitialized } = useConfigStore();
  const { products, loadCatalog, addProduct, updateProduct, deleteProduct } = useCatalogStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);

  useEffect(() => {
    if (isInitialized) {
      loadCatalog();
    }
  }, [isInitialized, loadCatalog]);

  const handleOpenModal = (productId?: string) => {
    if (productId) {
      const product = products.find(p => p.id === productId);
      if (product) {
        setFormData({
          name: product.name,
          description: product.description ?? '',
          unitAmount: product.unitAmount / 100,
          currency: product.currency,
          active: product.active,
        });
        setEditingProductId(productId);
      }
    } else {
      setFormData(emptyForm);
      setEditingProductId(null);
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setFormData(emptyForm);
    setEditingProductId(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const productData: Omit<ProductDefinition, 'id' | 'createdAt' | 'updatedAt'> = {
      name: formData.name,
      description: formData.description || null,
      unitAmount: Math.round(formData.unitAmount * 100),
      currency: formData.currency,
      active: formData.active,
      metadata: {},
    };

    if (editingProductId) {
      updateProduct(editingProductId, productData);
    } else {
      addProduct(productData);
    }

    handleCloseModal();
  };

  const handleDelete = (id: string) => {
    if (confirm(t('products.confirmDelete', 'Are you sure you want to delete this product?'))) {
      deleteProduct(id);
    }
  };

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
  };

  if (!isInitialized) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title={t('products.empty.title', 'No products yet')}
        description={t('products.empty.description', 'Create products for one-time payments')}
      />
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title={t('products.title', 'Products')}
        description={t('products.description', 'One-time payment items for charges')}
        icon={ShoppingBag}
        helpTitle={t('products.helpTitle', 'Products')}
        helpContent={
          <div className="space-y-2">
            <p>
              {t('products.helpContent', 'Products are items for one-time payments. Use them for setup fees, consulting charges, or any non-recurring item.')}
            </p>
            <p
              className="text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {t('products.helpExamples', 'Examples: Setup Fee, Consulting Hour, Custom Development, Premium Support')}
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => handleOpenModal()}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4" />
            {t('products.addProduct', 'Add Product')}
          </button>
        }
      />

      {/* Products List */}
      {products.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title={t('products.empty.title', 'No products yet')}
          description={t('products.empty.description', 'Create products for one-time payments')}
          action={
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4" />
              {t('products.empty.createFirst', 'Create your first product')}
            </button>
          }
          tips={[
            t('products.tips.tip1', 'Products are for one-time charges, not subscriptions'),
            t('products.tips.tip2', 'Use descriptive names for easy identification'),
            t('products.tips.tip3', 'You can charge custom amounts even without products'),
          ]}
        />
      ) : (
        <div className="space-y-4">
          {products.map(product => (
            <div key={product.id} className="card p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="font-semibold" style={{ color: 'var(--color-text)' }}>
                      {product.name}
                    </h3>
                    <span className="badge badge-primary">
                      {formatAmount(product.unitAmount, product.currency)}
                    </span>
                    <span className={`badge ${product.active ? 'badge-success' : 'badge-error'}`}>
                      {product.active ? tc('status.active') : tc('status.inactive')}
                    </span>
                  </div>
                  {product.description && (
                    <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
                      {product.description}
                    </p>
                  )}
                  <p className="text-xs mt-2 font-mono" style={{ color: 'var(--color-text-muted)' }}>
                    {product.id}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenModal(product.id)}
                    className="btn btn-ghost p-2"
                    title="Edit product"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    className="btn btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-900/30"
                    title="Delete product"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--color-text)' }}>
                {editingProductId
                  ? t('products.modal.editTitle', 'Edit Product')
                  : t('products.modal.createTitle', 'Create Product')}
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="btn btn-ghost p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body space-y-4">
                <div>
                  <label htmlFor="productName" className="label">
                    {t('products.modal.nameLabel', 'Product Name')}
                  </label>
                  <input
                    id="productName"
                    type="text"
                    value={formData.name}
                    onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder={t('products.modal.namePlaceholder', 'e.g., Setup Fee, Consulting Hour')}
                    className="input"
                    autoFocus
                  />
                </div>

                <div>
                  <label htmlFor="productDescription" className="label">
                    {t('products.modal.descriptionLabel', 'Description')}
                  </label>
                  <textarea
                    id="productDescription"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder={t('products.modal.descriptionPlaceholder', 'Describe what this product is for')}
                    className="input min-h-[80px] resize-y"
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="productAmount" className="label">
                      {t('products.modal.priceLabel', 'Price')}
                    </label>
                    <input
                      id="productAmount"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.unitAmount}
                      onChange={e => setFormData(prev => ({ ...prev, unitAmount: parseFloat(e.target.value) || 0 }))}
                      className="input"
                    />
                  </div>
                  <div>
                    <label htmlFor="productCurrency" className="label">
                      {t('products.modal.currencyLabel', 'Currency')}
                    </label>
                    <select
                      id="productCurrency"
                      value={formData.currency}
                      onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value as QZPayCurrency }))}
                      className="select"
                    >
                      {CURRENCIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    id="productActive"
                    type="checkbox"
                    checked={formData.active}
                    onChange={e => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                    className="w-4 h-4 rounded"
                  />
                  <label htmlFor="productActive" className="text-sm" style={{ color: 'var(--color-text)' }}>
                    {t('products.modal.activeLabel', 'Product is active')}
                  </label>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="btn btn-secondary"
                >
                  {tc('buttons.cancel')}
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!formData.name.trim()}
                >
                  {editingProductId
                    ? t('products.modal.saveChanges', 'Save Changes')
                    : t('products.modal.createProduct', 'Create Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
