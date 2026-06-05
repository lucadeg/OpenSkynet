import { useState, useEffect } from 'react';
import { Server, Check, Key, Globe, CheckCircle, AlertCircle, Copy, RefreshCw, ChevronRight, Search } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/shared/Button';
import { Input } from '@/components/shared/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/Card';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { Badge } from '@/components/shared/Badge';
import { useAppStore } from '@/stores/useAppStore';

interface ProviderInfo {
  name: string;
  display_name?: string;
  category: string;
  needs_api_key: boolean;
  has_key: boolean;
  auto_detect: boolean;
}

interface ProviderModelInfo {
  provider: string;
  default_model: string;
  available: Array<{ id: string; name: string }>;
  has_key: boolean;
}

export function ProviderPage() {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [models, setModels] = useState<ProviderModelInfo[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [testing, setTesting] = useState<string | null>(null);
  const [expandedProvider, setExpandedProvider] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, 'connected' | 'disconnected' | 'error'>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const setCurrentProvider = useAppStore((state) => state.setProvider);

  useEffect(() => {
    loadProviders();
    loadModels();
  }, []);

  const loadProviders = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/model/providers', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setProviders(data.providers || []);
      }
    } catch {
      console.error('Failed to load providers');
    }
  };

  const loadModels = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/model/list', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json();
        setModels(data.models || []);
      }
    } catch {
      console.error('Failed to load models');
    }
  };

  const handleSelectProvider = (providerName: string) => {
    setSelectedProvider(providerName);
    setCurrentProvider(providerName);
    setExpandedProvider(providerName === expandedProvider ? null : providerName);
    // Reset API key and base URL when switching providers
    setApiKey('');
    setBaseUrl('');
  };

  const handleApiKeyChange = (value: string) => {
    setApiKey(value);
  };

  const handleUrlChange = (value: string) => {
    setBaseUrl(value);
  };

  const handleTest = async () => {
    if (!selectedProvider) return;
    setTesting(selectedProvider);
    try {
      const response = await fetch('http://localhost:3001/api/model/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          model: undefined,
          base_url: baseUrl || undefined
        }),
      });

      if (response.ok) {
        setStatuses(prev => ({ ...prev, [selectedProvider]: 'connected' }));
      } else {
        setStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
      }
    } catch {
      setStatuses(prev => ({ ...prev, [selectedProvider]: 'error' }));
    } finally {
      setTesting(null);
    }
  };

  const handleSave = async () => {
    if (!selectedProvider) return;
    try {
      // For now, just save to environment via API
      // In production, this would save to a config file
      const response = await fetch('http://localhost:3001/api/model/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          base_url: baseUrl || undefined
        }),
      });

      if (response.ok) {
        alert('Provider saved successfully!');
        setStatuses(prev => ({ ...prev, [selectedProvider]: 'connected' }));
      } else {
        alert('Failed to save provider');
      }
    } catch {
      alert('Failed to save provider');
    }
  };

  const getStatusIcon = (providerName: string) => {
    const status = statuses[providerName];
    if (status === 'connected') return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (status === 'error') return <AlertCircle className="w-4 h-4 text-red-500" />;
    return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
  };

  const getStatusBadge = (provider: ProviderInfo) => {
    if (provider.has_key) {
      return <Badge variant="success" className="text-xs">Configured</Badge>;
    } else if (provider.needs_api_key) {
      return <Badge variant="warning" className="text-xs">Needs Key</Badge>;
    } else {
      return <Badge variant="info" className="text-xs">No Key Needed</Badge>;
    }
  };

  const filteredProviders = providers.filter((provider) => {
    const query = searchQuery.toLowerCase();
    return (
      provider.name.toLowerCase().includes(query) ||
      (provider.display_name?.toLowerCase() || '').includes(query) ||
      provider.category.toLowerCase().includes(query)
    );
  });

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        icon={Server}
        title="Provider"
        subtitle="Configure LLM providers and models"
      />

      <ScrollArea className="flex-1">
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search providers..."
              className="pl-9"
            />
          </div>

          {/* Providers List */}
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              Providers ({filteredProviders.length})
            </h2>

            {filteredProviders.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  {searchQuery ? 'No providers match your search' : 'No providers found. Check your server configuration.'}
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredProviders.map((provider) => {
                  const isExpanded = expandedProvider === provider.name;
                  const isSelected = selectedProvider === provider.name;

                  return (
                    <Card
                      key={provider.name}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        isSelected ? 'border-primary' : ''
                      }`}
                      onClick={() => handleSelectProvider(provider.name)}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <CardTitle className="text-lg">{provider.display_name || provider.name}</CardTitle>
                              {getStatusBadge(provider)}
                            </div>
                            <CardDescription className="text-sm mt-1">
                              {provider.category === 'cloud' ? 'Cloud Provider' : provider.category === 'local' ? 'Local Provider' : provider.category === 'cloud-cn' ? 'Cloud Provider (China)' : provider.category}
                            </CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            {isSelected && <Check className="w-5 h-5 text-primary" />}
                            {getStatusIcon(provider.name)}
                            <ChevronRight
                              className={`w-5 h-5 text-muted-foreground transition-transform ${
                                isExpanded ? 'rotate-90' : ''
                              }`}
                            />
                          </div>
                        </div>
                      </CardHeader>

                      {isExpanded && selectedProvider === provider.name && (
                        <CardContent className="space-y-4 pt-0">
                          {/* API Key Configuration */}
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              API Key
                              {provider.needs_api_key && ' (Required)'}
                            </label>
                            <div className="flex gap-2">
                              <Input
                                type="password"
                                value={apiKey}
                                onChange={(e) => handleApiKeyChange(e.target.value)}
                                placeholder={provider.needs_api_key ? "Enter your API key..." : "No key needed"}
                                className="flex-1"
                                disabled={!provider.needs_api_key}
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const key = apiKey || process.env[
                                    provider.name === 'openai' ? 'OPENAI_API_KEY' :
                                    provider.name === 'anthropic' ? 'ANTHROPIC_API_KEY' : ''
                                  ];
                                  if (key) {
                                    navigator.clipboard.writeText(key);
                                  }
                                }}
                              >
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {provider.needs_api_key
                                ? `Or set ${provider.name.toUpperCase()}_API_KEY environment variable`
                                : 'This provider does not require an API key'
                              }
                            </p>
                          </div>

                          {/* Custom Base URL */}
                          <div>
                            <label className="text-sm font-medium mb-2 block">
                              Base URL (Optional)
                            </label>
                            <Input
                              value={baseUrl}
                              onChange={(e) => handleUrlChange(e.target.value)}
                              placeholder="Use default endpoint"
                            />
                          </div>

                          {/* Test Connection */}
                          <div className="flex gap-3 pt-2">
                            <Button
                              variant="outline"
                              onClick={handleTest}
                              disabled={testing === selectedProvider}
                              className="flex-1"
                            >
                              {testing === selectedProvider ? (
                                <>
                                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                  Testing...
                                </>
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-2" />
                                  Test Connection
                                </>
                              )}
                            </Button>
                            <Button
                              onClick={handleSave}
                              className="flex-1"
                              disabled={!provider.needs_api_key && !baseUrl}
                            >
                              <Key className="w-4 h-4 mr-2" />
                              Save Configuration
                            </Button>
                          </div>

                          {/* Available Models */}
                          <div>
                            <h3 className="text-sm font-medium mb-3">Available Models</h3>
                            <div className="grid grid-cols-2 gap-2">
                              {models
                                .filter(m => m.provider === selectedProvider)
                                .flatMap(m => m.available)
                                .map((model) => (
                                  <Badge
                                    key={model.id}
                                    variant="default"
                                    className="text-xs justify-between"
                                  >
                                    <span>{model.id}</span>
                                    <span className="text-xs text-muted-foreground">{model.name}</span>
                                  </Badge>
                                ))}
                            </div>
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
