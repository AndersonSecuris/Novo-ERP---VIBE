import React, { useState, useEffect } from 'react';
import {
  Smartphone,
  User,
  CheckSquare,
  Camera,
  Wrench,
  DollarSign,
  Plus,
  Trash2,
  X,
  Upload,
  Check,
  AlertTriangle,
  Lock,
  FileText,
  Clock,
  Sparkles,
  Search,
  Eye
} from 'lucide-react';
import {
  ServiceOrder,
  Client,
  Product,
  OSChecklist,
  OSPhoto,
  OSPart,
  OSServiceItem,
  OSStatus,
  OSPriority
} from '../../types';
import { api, formatCurrency } from '../../services/api';
import { PatternLock } from '../common/PatternLock';

interface ServiceOrderModalProps {
  osToEdit?: ServiceOrder | null;
  clients: Client[];
  products: Product[];
  onClose: () => void;
  onSaved: (savedOS: ServiceOrder) => void;
}

const COMMON_BRANDS = ['Apple', 'Samsung', 'Motorola', 'Xiaomi', 'Realme', 'LG', 'Asus', 'Outra'];

const ACCESSORIES_OPTIONS = [
  'Carregador Original',
  'Cabo USB',
  'Capinha Protetora',
  'Película Aplicada',
  'Gaveta de Chip (SIM Tray)',
  'Chip SIM Operadora',
  'Cartão MicroSD',
  'Caixa Original'
];

export const ServiceOrderModal: React.FC<ServiceOrderModalProps> = ({
  osToEdit,
  clients,
  products,
  onClose,
  onSaved
}) => {
  const isEditing = !!osToEdit;

  // Tabs inside modal
  const [activeTab, setActiveTab] = useState<'device' | 'checklist' | 'photos' | 'services' | 'summary'>('device');

  // Client info
  const [clientId, setClientId] = useState(osToEdit?.client_id || '');
  const [clientName, setClientName] = useState(osToEdit?.client_name || '');
  const [clientPhone, setClientPhone] = useState(osToEdit?.client_phone || '');
  const [clientCpf, setClientCpf] = useState(osToEdit?.client_cpf || '');
  const [clientEmail, setClientEmail] = useState(osToEdit?.client_email || '');

  // Device info
  const [deviceType, setDeviceType] = useState(osToEdit?.device_type || 'smartphone');
  const [deviceBrand, setDeviceBrand] = useState(osToEdit?.device_brand || 'Apple');
  const [customBrand, setCustomBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState(osToEdit?.device_model || '');
  const [deviceColor, setDeviceColor] = useState(osToEdit?.device_color || '');
  const [deviceImei, setDeviceImei] = useState(osToEdit?.device_imei || '');
  const [deviceSerial, setDeviceSerial] = useState(osToEdit?.device_serial || '');
  const [devicePassword, setDevicePassword] = useState(osToEdit?.device_password || '');
  const [devicePatternLock, setDevicePatternLock] = useState(osToEdit?.device_pattern_lock || '');
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>(osToEdit?.device_accessories || []);
  const [deviceCondition, setDeviceCondition] = useState(osToEdit?.device_condition || '');
  const [reportedDefect, setReportedDefect] = useState(osToEdit?.reported_defect || '');

  // Technical & Diagnosis
  const [technicalDiagnosis, setTechnicalDiagnosis] = useState(osToEdit?.technical_diagnosis || '');
  const [technicalSolution, setTechnicalSolution] = useState(osToEdit?.technical_solution || '');
  const [status, setStatus] = useState<OSStatus>(osToEdit?.status || 'aguardando_analise');
  const [priority, setPriority] = useState<OSPriority>(osToEdit?.priority || 'normal');
  const [technicianName, setTechnicianName] = useState(osToEdit?.technician_name || 'Técnico Geral');
  const [warrantyTerms, setWarrantyTerms] = useState(osToEdit?.warranty_terms || 'Garantia de 90 dias conforme Art. 26 do CDC.');
  const [estimatedDelivery, setEstimatedDelivery] = useState(osToEdit?.estimated_delivery || '');

  // Checklists (In & Out)
  const [checklistIn, setChecklistIn] = useState<OSChecklist>(osToEdit?.checklist_in || {
    screen: true,
    touch: true,
    cameras: true,
    mic: true,
    speaker: true,
    charging: true,
    wifi: true,
    bluetooth: true,
    biometrics: true,
    buttons: true,
    water_damage: false,
    sim_reading: true
  });

  const [checklistOut, setChecklistOut] = useState<OSChecklist>(osToEdit?.checklist_out || {});

  // Photos
  const [photos, setPhotos] = useState<OSPhoto[]>(osToEdit?.photos || []);
  const [newPhotoCaption, setNewPhotoCaption] = useState('');
  const [newPhotoType, setNewPhotoType] = useState<'entry' | 'repair' | 'exit'>('entry');
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);

  // Parts & Services
  const [partsUsed, setPartsUsed] = useState<OSPart[]>(osToEdit?.parts_used || []);
  const [servicesDone, setServicesDone] = useState<OSServiceItem[]>(osToEdit?.services_done || []);
  const [discount, setDiscount] = useState<number>(osToEdit?.discount || 0);

  // Quick Part Add selection
  const [selectedPartId, setSelectedPartId] = useState('');
  const [customServiceName, setCustomServiceName] = useState('');
  const [customServicePrice, setCustomServicePrice] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Handle client select
  const handleClientSelect = (id: string) => {
    setClientId(id);
    const found = clients.find(c => c.id === id);
    if (found) {
      setClientName(found.name);
      setClientPhone(found.phone);
      setClientCpf(found.cpf || '');
      setClientEmail(found.email || '');
    }
  };

  const toggleAccessory = (acc: string) => {
    setSelectedAccessories(prev =>
      prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]
    );
  };

  const toggleChecklistIn = (key: keyof OSChecklist) => {
    setChecklistIn(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Add Part
  const handleAddPart = () => {
    if (!selectedPartId) return;
    const prod = products.find(p => p.id === selectedPartId);
    if (!prod) return;

    setPartsUsed(prev => {
      const idx = prev.findIndex(p => p.productId === prod.id);
      if (idx > -1) {
        const updated = [...prev];
        updated[idx].quantity += 1;
        return updated;
      }
      return [
        ...prev,
        {
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.sale_price,
          costPrice: prod.cost_price
        }
      ];
    });
    setSelectedPartId('');
  };

  const handleRemovePart = (index: number) => {
    setPartsUsed(prev => prev.filter((_, i) => i !== index));
  };

  // Add Service
  const handleAddService = () => {
    if (!customServiceName.trim()) return;
    const price = parseFloat(customServicePrice) || 0;
    setServicesDone(prev => [
      ...prev,
      { name: customServiceName.trim(), price }
    ]);
    setCustomServiceName('');
    setCustomServicePrice('');
  };

  const handleRemoveService = (index: number) => {
    setServicesDone(prev => prev.filter((_, i) => i !== index));
  };

  // Add Photo (File upload base64 or webcam)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      const newPhoto: OSPhoto = {
        id: 'photo-' + Date.now(),
        url: base64,
        timestamp: new Date().toISOString(),
        type: newPhotoType,
        caption: newPhotoCaption.trim() || `Foto de ${newPhotoType === 'entry' ? 'Entrada' : newPhotoType === 'repair' ? 'Reparo' : 'Saída'}`
      };
      setPhotos(prev => [...prev, newPhoto]);
      setNewPhotoCaption('');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = (id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Totals calculations
  const partsCost = partsUsed.reduce((acc, p) => acc + p.unitPrice * p.quantity, 0);
  const servicesCost = servicesDone.reduce((acc, s) => acc + s.price, 0);
  const total = Math.max(0, partsCost + servicesCost - (discount || 0));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName.trim() || !clientPhone.trim()) {
      setErrorMsg('Informe o nome e o telefone do cliente.');
      setActiveTab('device');
      return;
    }
    if (!deviceModel.trim() || !reportedDefect.trim()) {
      setErrorMsg('Informe o modelo do aparelho e o defeito relatado.');
      setActiveTab('device');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMsg('');

      const brandToSave = deviceBrand === 'Outra' ? (customBrand || 'Outra') : deviceBrand;

      const payload: Partial<ServiceOrder> = {
        client_id: clientId || 'cli-generic',
        client_name: clientName,
        client_phone: clientPhone,
        client_cpf: clientCpf,
        client_email: clientEmail,
        device_type: deviceType as any,
        device_brand: brandToSave,
        device_model: deviceModel,
        device_color: deviceColor,
        device_imei: deviceImei,
        device_serial: deviceSerial,
        device_password: devicePassword,
        device_pattern_lock: devicePatternLock,
        device_accessories: selectedAccessories,
        device_condition: deviceCondition,
        reported_defect: reportedDefect,
        technical_diagnosis: technicalDiagnosis,
        technical_solution: technicalSolution,
        checklist_in: checklistIn,
        checklist_out: checklistOut,
        photos,
        parts_used: partsUsed,
        services_done: servicesDone,
        parts_cost: partsCost,
        services_cost: servicesCost,
        discount: discount || 0,
        total,
        status,
        priority,
        technician_name: technicianName,
        warranty_terms: warrantyTerms,
        estimated_delivery: estimatedDelivery
      };

      let saved: ServiceOrder;
      if (isEditing && osToEdit) {
        saved = await api.updateServiceOrder(osToEdit.id, payload);
      } else {
        saved = await api.createServiceOrder(payload);
      }

      onSaved(saved);
      onClose();
    } catch (err: any) {
      setErrorMsg(`Erro ao salvar OS: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const checklistItems: { key: keyof OSChecklist; label: string }[] = [
    { key: 'screen', label: 'Tela / Display LCD' },
    { key: 'touch', label: 'Sensibilidade do Touch' },
    { key: 'charging', label: 'Conector de Carga' },
    { key: 'cameras', label: 'Câmeras (Frontal/Traseira)' },
    { key: 'mic', label: 'Microfone' },
    { key: 'speaker', label: 'Alto-falante / Auricular' },
    { key: 'wifi', label: 'Wi-Fi & Conexão' },
    { key: 'bluetooth', label: 'Bluetooth' },
    { key: 'biometrics', label: 'Biometria / Face ID' },
    { key: 'buttons', label: 'Botões Físicos (Power/Vol)' },
    { key: 'sim_reading', label: 'Leitura de Chip SIM' },
    { key: 'water_damage', label: 'Sinais de Oxidação / Molhado' }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">
                {isEditing ? `Editar Ordem de Serviço #${osToEdit.os_number}` : 'Nova Ordem de Serviço (Assistência Técnica)'}
              </h3>
              <p className="text-xs text-slate-500">
                Cadastro de aparelho, checklist, laudo, peças, fotos e orçamento
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-100 bg-slate-50/50 px-6 gap-2 pt-2 overflow-x-auto">
          {[
            { id: 'device', label: 'Cliente & Aparelho', icon: Smartphone },
            { id: 'checklist', label: 'Checklist de Entrada', icon: CheckSquare },
            { id: 'photos', label: `Fotos (${photos.length})`, icon: Camera },
            { id: 'services', label: 'Peças & Serviços', icon: Wrench },
            { id: 'summary', label: 'Status & Totais', icon: DollarSign }
          ].map(tab => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all flex items-center gap-2 cursor-pointer ${
                  isSelected
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 text-xs flex-1">
          {/* TAB 1: CLIENT & DEVICE */}
          {activeTab === 'device' && (
            <div className="space-y-6">
              {/* Section 1: Client */}
              <div>
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  Dados do Cliente
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label className="block text-slate-600 font-semibold mb-1">Selecionar Cliente</label>
                    <select
                      value={clientId}
                      onChange={e => handleClientSelect(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="">-- Cliente Avulso ou Novo --</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Nome do Cliente *</label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={e => setClientName(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="Nome completo"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">WhatsApp / Telefone *</label>
                    <input
                      type="text"
                      required
                      value={clientPhone}
                      onChange={e => setClientPhone(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="(11) 98765-4321"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Device identification */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <Smartphone className="w-4 h-4 text-blue-600" />
                  Identificação do Aparelho
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Marca</label>
                    <select
                      value={deviceBrand}
                      onChange={e => setDeviceBrand(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                    >
                      {COMMON_BRANDS.map(b => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  {deviceBrand === 'Outra' && (
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Nome da Marca</label>
                      <input
                        type="text"
                        value={customBrand}
                        onChange={e => setCustomBrand(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                        placeholder="Ex: Huawei, Positivo"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Modelo do Aparelho *</label>
                    <input
                      type="text"
                      required
                      value={deviceModel}
                      onChange={e => setDeviceModel(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="Ex: iPhone 13 128GB, Moto G84"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Cor</label>
                    <input
                      type="text"
                      value={deviceColor}
                      onChange={e => setDeviceColor(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                      placeholder="Ex: Grafite, Azul, Preto"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">IMEI (15 dígitos)</label>
                    <input
                      type="text"
                      value={deviceImei}
                      onChange={e => setDeviceImei(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                      placeholder="Ex: 354892091823901"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Security & Passwords */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-3">
                  <Lock className="w-4 h-4 text-blue-600" />
                  Segurança / Desbloqueio do Aparelho
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Senha Alfanumérica / PIN Numérico
                    </label>
                    <input
                      type="text"
                      value={devicePassword}
                      onChange={e => setDevicePassword(e.target.value)}
                      className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-sm focus:outline-none focus:border-blue-500"
                      placeholder="Ex: 1234 ou senha@2024"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Necessário para testes pós-reparo (touch, câmeras, sensores).
                    </p>
                  </div>

                  <div>
                    <PatternLock
                      value={devicePatternLock}
                      onChange={setDevicePatternLock}
                    />
                  </div>
                </div>
              </div>

              {/* Section 4: Accessories & Condition */}
              <div className="pt-4 border-t border-slate-200">
                <h4 className="font-bold text-slate-900 text-sm mb-2">Acessórios Deixados na Loja</h4>
                <div className="flex flex-wrap gap-2 mb-4">
                  {ACCESSORIES_OPTIONS.map(acc => {
                    const isChecked = selectedAccessories.includes(acc);
                    return (
                      <button
                        key={acc}
                        type="button"
                        onClick={() => toggleAccessory(acc)}
                        className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-blue-600 border-blue-600 text-white shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5" />}
                        {acc}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Estado Físico / Condição Visual de Entrada
                    </label>
                    <input
                      type="text"
                      value={deviceCondition}
                      onChange={e => setDeviceCondition(e.target.value)}
                      placeholder="Ex: Vidro trincado no canto superior, tampa traseira com arranhões leves"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">
                      Defeito Relatado pelo Cliente *
                    </label>
                    <input
                      type="text"
                      required
                      value={reportedDefect}
                      onChange={e => setReportedDefect(e.target.value)}
                      placeholder="Ex: Não liga após queda, touch falhando no centro"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CHECKLIST */}
          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                <span className="font-bold">Checklist de Entrada e Inspeção:</span> Marque os componentes funcionais no momento do recebimento. Itens desmarcados indicam avaria prévia do cliente.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                {checklistItems.map(item => {
                  const isOk = !!checklistIn[item.key];
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => toggleChecklistIn(item.key)}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all cursor-pointer ${
                        isOk
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-rose-50 border-rose-200 text-rose-800'
                      }`}
                    >
                      <span className="font-semibold">{item.label}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                          isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {isOk ? 'OK / Funciona' : 'Defeito / N/A'}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div>
                <label className="block text-slate-600 font-semibold mb-1">
                  Observações Adicionais do Checklist
                </label>
                <textarea
                  rows={2}
                  value={checklistIn.notes || ''}
                  onChange={e => setChecklistIn(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ex: Sensor de proximidade apaga mas biometria não cadastra nova digital..."
                  className="w-full p-3 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* TAB 3: PHOTOS */}
          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <Camera className="w-4 h-4 text-blue-600" />
                  Adicionar Foto ao Laudo da OS
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Tipo de Foto</label>
                    <select
                      value={newPhotoType}
                      onChange={e => setNewPhotoType(e.target.value as any)}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                    >
                      <option value="entry">Foto de Entrada (Estado Inicial)</option>
                      <option value="repair">Durante Reparo (Bancada/Placa)</option>
                      <option value="exit">Foto de Saída (Finalizado)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Legenda / Descrição</label>
                    <input
                      type="text"
                      value={newPhotoCaption}
                      onChange={e => setNewPhotoCaption(e.target.value)}
                      placeholder="Ex: Trinca frontal, oxidação conector"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-600 font-semibold mb-1">Selecionar Imagem</label>
                    <label className="w-full px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-xs">
                      <Upload className="w-4 h-4" />
                      Enviar Foto / Câmera
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Photo Gallery Grid */}
              {photos.length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Camera className="w-12 h-12 stroke-1 mx-auto mb-2 text-slate-300" />
                  Nenhuma foto anexada a esta ordem de serviço.
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {photos.map(photo => (
                    <div
                      key={photo.id}
                      className="relative group rounded-xl overflow-hidden border border-slate-200 bg-white flex flex-col shadow-xs"
                    >
                      <div className="relative aspect-video bg-slate-100 overflow-hidden">
                        <img
                          src={photo.url}
                          alt={photo.caption || 'Foto da OS'}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <button
                          type="button"
                          onClick={() => setViewingPhoto(photo.url)}
                          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity cursor-pointer"
                        >
                          <Eye className="w-6 h-6" />
                        </button>
                      </div>

                      <div className="p-2 flex-1 flex flex-col justify-between">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-blue-600 block">
                            {photo.type === 'entry' ? 'Entrada' : photo.type === 'repair' ? 'Reparo' : 'Saída'}
                          </span>
                          <p className="text-[11px] text-slate-700 truncate">{photo.caption}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(photo.id)}
                          className="text-[10px] text-rose-600 hover:text-rose-700 flex items-center gap-1 mt-1 cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          Remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PARTS & SERVICES */}
          {activeTab === 'services' && (
            <div className="space-y-6">
              {/* Technical Diagnosis Text */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Laudo Técnico / Diagnóstico
                  </label>
                  <textarea
                    rows={2}
                    value={technicalDiagnosis}
                    onChange={e => setTechnicalDiagnosis(e.target.value)}
                    placeholder="Ex: Tela danificada por impacto físico, placa principal intacta..."
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Solução Técnica / Procedimento Executado
                  </label>
                  <textarea
                    rows={2}
                    value={technicalSolution}
                    onChange={e => setTechnicalSolution(e.target.value)}
                    placeholder="Ex: Troca de display frontal + limpeza química do conector"
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Parts Selection from Inventory */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Peças Utilizadas (Baixa Automática no Estoque)</span>
                  <span className="text-emerald-600 font-mono">{formatCurrency(partsCost)}</span>
                </h5>

                <div className="flex gap-2">
                  <select
                    value={selectedPartId}
                    onChange={e => setSelectedPartId(e.target.value)}
                    className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="">-- Selecione uma peça do estoque --</option>
                    {products
                      .filter(p => p.type !== 'service')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (Estoque: {p.stock} | {formatCurrency(p.sale_price)})
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddPart}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar Peça
                  </button>
                </div>

                {partsUsed.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {partsUsed.map((part, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200"
                      >
                        <div>
                          <div className="font-semibold text-slate-800">{part.name}</div>
                          <div className="text-[11px] text-slate-500">
                            {part.quantity}x a {formatCurrency(part.unitPrice)}
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-emerald-600 font-mono">
                            {formatCurrency(part.unitPrice * part.quantity)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemovePart(idx)}
                            className="text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Services / Labor */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <h5 className="font-bold text-slate-900 flex items-center justify-between">
                  <span>Mão de Obra / Serviços Executados</span>
                  <span className="text-purple-600 font-mono">{formatCurrency(servicesCost)}</span>
                </h5>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={customServiceName}
                    onChange={e => setCustomServiceName(e.target.value)}
                    placeholder="Descrição do serviço (ex: Mão de obra troca de tela)"
                    className="sm:col-span-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      step="0.01"
                      value={customServicePrice}
                      onChange={e => setCustomServicePrice(e.target.value)}
                      placeholder="Valor R$"
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleAddService}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shrink-0 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {servicesDone.length > 0 && (
                  <div className="space-y-2 mt-3">
                    {servicesDone.map((srv, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-white border border-slate-200"
                      >
                        <span className="font-semibold text-slate-800">{srv.name}</span>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-purple-600 font-mono">
                            {formatCurrency(srv.price)}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveService(idx)}
                            className="text-rose-600 hover:text-rose-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SUMMARY & STATUS */}
          {activeTab === 'summary' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Status da OS</label>
                  <select
                    value={status}
                    onChange={e => setStatus(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 text-xs focus:outline-none focus:border-blue-500 font-bold"
                  >
                    <option value="aguardando_analise">Aguardando Análise</option>
                    <option value="em_analise">Em Análise / Orçamento</option>
                    <option value="aguardando_aprovacao">Aguardando Aprovação</option>
                    <option value="aprovado">Aprovado / Em Reparo</option>
                    <option value="aguardando_peca">Aguardando Peça</option>
                    <option value="pronto">Pronto para Retirada</option>
                    <option value="entregue">Entregue / Finalizado</option>
                    <option value="cancelado">Cancelado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Prioridade</label>
                  <select
                    value={priority}
                    onChange={e => setPriority(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="baixa">Baixa</option>
                    <option value="normal">Normal</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Técnico Responsável</label>
                  <input
                    type="text"
                    value={technicianName}
                    onChange={e => setTechnicianName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-600 font-semibold mb-1">
                    Previsão de Conclusão / Entrega
                  </label>
                  <input
                    type="date"
                    value={estimatedDelivery}
                    onChange={e => setEstimatedDelivery(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-semibold mb-1">Desconto Aplicado (R$)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={discount || ''}
                    onChange={e => setDiscount(parseFloat(e.target.value) || 0)}
                    placeholder="0,00"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Financial Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Peças:</span>
                  <span className="font-mono">{formatCurrency(partsCost)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal Serviços / Mão de Obra:</span>
                  <span className="font-mono">{formatCurrency(servicesCost)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-rose-600 font-semibold">
                    <span>Desconto:</span>
                    <span className="font-mono">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t border-slate-200">
                  <span>VALOR TOTAL DO ORÇAMENTO:</span>
                  <span className="text-emerald-600 font-mono text-xl">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              {submitting ? 'Salvando...' : isEditing ? 'Salvar Alterações da OS' : 'Criar Ordem de Serviço'}
            </button>
          </div>
        </form>
      </div>

      {/* Photo Lightbox */}
      {viewingPhoto && (
        <div
          onClick={() => setViewingPhoto(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img src={viewingPhoto} alt="Zoom" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </div>
  );
};
