# Android e Play Store

## Identidade do app

- Nome: Controle Financeiro
- Package ID: `com.tryndadi.controlefinanceiro`

Importante: o Package ID fica permanente depois que o app for criado no Play Console.

## Comandos do projeto

Depois de instalar dependencias com `npm install`:

```powershell
npm run android:sync
npm run android:debug
npm run android:bundle
```

O APK de teste fica em:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

O AAB de release fica em:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

## Quando mudar o frontend

Sempre que alterar arquivos dentro de `public/`, rode:

```powershell
npm run android:sync
```

Isso copia a versao atual do app web para dentro do projeto Android.

## Antes de enviar para a Play Store

1. Testar o APK debug em um celular real.
2. Gerar um AAB assinado no Android Studio:
   - Build > Generate Signed App Bundle / APK
   - Escolher Android App Bundle
   - Criar ou selecionar a upload key
   - Guardar a chave fora do repositorio
3. No Play Console:
   - Criar o app
   - Preencher ficha da loja
   - Enviar screenshots
   - Preencher seguranca de dados
   - Preencher classificacao indicativa
   - Criar uma release de teste interno
   - Subir o AAB assinado

## Chaves

Arquivos `.jks`, `.keystore` e `key.properties` nao devem ir para o Git.
