# Imagem dos Pastores Presidentes

## Instruções para adicionar a foto do casal de pastores

Para que a seção de pastores funcione corretamente, você precisa adicionar uma imagem dos pastores presidentes na pasta `public/`.

### Passos:

1. **Nome do arquivo**: A imagem deve ser nomeada como `pastores-casal.jpg`
2. **Localização**: Coloque o arquivo na pasta `public/pastores-casal.jpg`
3. **Formato recomendado**: JPG ou PNG
4. **Dimensões recomendadas**: 800x600 pixels ou proporção similar (4:3)
5. **Qualidade**: Alta resolução para melhor apresentação

### Formato esperado:

- Uma foto do casal de pastores presidentes
- Preferencialmente em ambiente formal ou da igreja
- Boa iluminação e qualidade de imagem
- Orientação paisagem (horizontal)

### Personalização adicional:

No arquivo `/app/home/page.tsx`, você pode personalizar:

1. **Nomes dos pastores**: Substitua "Nome do Pastor" e "Nome da Pastora" pelos nomes reais
2. **Descrição**: Modifique o texto descritivo sobre os pastores
3. **Versículo bíblico**: Altere o versículo se desejar
4. **Cores e estilo**: Ajuste as cores conforme necessário

### Exemplo de edição dos nomes:

```tsx
<h3 className="text-3xl font-bold text-[#015C91] mb-2">
  Pastor João Silva
</h3>

<h4 className="text-2xl font-bold text-[#015C91] mb-2">
  Pastora Maria Silva
</h4>
```
