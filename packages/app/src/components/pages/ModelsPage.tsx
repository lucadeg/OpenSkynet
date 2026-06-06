import { useState, useEffect } from 'react';
import { Bot, Check, Copy, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/shared/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/shared/Card';
import { ScrollArea } from '@/components/shared/ScrollArea';
import { useAppStore } from '@/stores/useAppStore';

interface Model {
  id: string;
  name: string;
  provider: string;
  contextLength: number;
  description: string;
  capabilities: string[];
}

const AVAILABLE_MODELS: Model[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextLength: 128000,
    description: 'Omni model with vision and advanced reasoning',
    capabilities: ['chat', 'vision', 'tools', 'code-generation']
  },
  {
    id: 'claude-sonnet-4-20250514',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    contextLength: 200000,
    description: 'Balanced performance and speed with extended context',
    capabilities: ['chat', 'vision', 'tools', 'code-generation']
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'Anthropic',
    contextLength: 200000,
    description: 'Highest quality output for complex tasks',
    capabilities: ['chat', 'vision', 'tools', 'code-generation', 'analysis']
  },
  {
    id: 'claude-haiku-4',
    name: 'Claude Haiku 4',
    provider: 'Anthropic',
    contextLength: 200000,
    description: 'Fast and efficient for simple tasks',
    capabilities: ['chat', 'tools', 'quick-tasks']
  },
  {
    id: 'o3-mini',
    name: 'O3 Mini',
    provider: 'OpenAI',
    contextLength: 200000,
    description: 'Advanced reasoning for complex problem-solving',
    capabilities: ['chat', 'reasoning', 'code-generation', 'analysis']
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    contextLength: 128000,
    description: 'Fast and efficient for everyday tasks',
    capabilities: ['chat', 'vision', 'tools', 'code-generation']
  }
];

export function ModelsPage() {
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const currentModel = useAppStore((state) => state.model);
  const setCurrentModel = useAppStore((state) => state.setModel);

  useEffect(() => {
    if (currentModel) {
      setSelectedModel(currentModel);
    }
  }, [currentModel]);

  const handleSelectModel = (modelId: string) => {
    setSelectedModel(modelId);
    setCurrentModel(modelId);
  };

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
  };

  const groupedModels = AVAILABLE_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) {
      acc[model.provider] = [];
    }
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<string, Model[]>);

  return (
    <div className="flex flex-col h-full bg-background">
      <PageHeader
        icon={Bot}
        title="Models"
        subtitle="Select AI model for agent"
      />

      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          {/* Current Selection */}
          {selectedModel && (
            <Card className="border-primary bg-primary/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Current Selection</CardTitle>
                    <CardDescription>
                      {AVAILABLE_MODELS.find(m => m.id === selectedModel)?.name}
                    </CardDescription>
                  </div>
                  <Check className="w-5 h-5 text-primary" />
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Models by Provider */}
          {Object.entries(groupedModels).map(([provider, models]) => (
            <div key={provider}>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                {provider}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {models.map((model) => (
                  <Card
                    key={model.id}
                    className={`cursor-pointer transition-all hover:shadow-lg ${
                      selectedModel === model.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectModel(model.id)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-base">{model.name}</CardTitle>
                          <CardDescription className="text-xs mt-1">
                            {model.description}
                          </CardDescription>
                        </div>
                        {selectedModel === model.id && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Context</span>
                        <span className="font-mono font-medium">
                          {(model.contextLength / 1000).toFixed(0)}K
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {model.capabilities.map((cap) => (
                          <span
                            key={cap}
                            className="text-xs px-2 py-1 rounded-md bg-primary/10 text-primary border border-primary/20"
                          >
                            {cap}
                          </span>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopyId(model.id);
                        }}
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy ID
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
