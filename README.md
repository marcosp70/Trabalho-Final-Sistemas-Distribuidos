# Sistema de Chat Distribuído

Este repositório contém o código-fonte para o trabalho final da disciplina de Sistemas Distribuídos do CEFET-MG (2026/1).

## 🚀 Sobre o Projeto

O objetivo deste projeto é construir uma plataforma de comunicação em tempo real que permita que múltiplos usuários troquem mensagens instantâneas. O sistema foi projetado com uma arquitetura distribuída para garantir:
*   **Alta Disponibilidade**
*   **Comunicação em Tempo Real (Baixa Latência)**
*   **Escalabilidade Horizontal**

## 🏗️ Arquitetura e Tecnologias

A aplicação é dividida em microsserviços, atendendo aos requisitos da disciplina:

*   **Frontend:** Interface web responsiva para interação do usuário.
*   **Serviço de Autenticação/Usuário:** Gerencia o ciclo de vida do usuário (Login/Senha) - *Persistência em Banco de Dados Relacional*.
*   **Serviço de Mensagens/Chat:** Responsável pela lógica de envio, recebimento, armazenamento e transmissão de mensagens em tempo real (1:1 e 1:N) - *Persistência em Banco de Dados NoSQL*.
*   **Comunicação Assíncrona:** Implementada com suporte a comunicação push e persistente (WebSockets).

## 📋 Requisitos para Execução

Este projeto foi containerizado com **Docker**, o que significa que **roda perfeitamente de forma idêntica tanto no Windows quanto no Linux** (e macOS).

*   [Docker Desktop](https://www.docker.com/products/docker-desktop) (para Windows/Mac) ou Docker Engine (para Linux).
*   [Docker Compose](https://docs.docker.com/compose/) instalado.
*   Node.js instalado na máquina local apenas caso você queira rodar os testes automatizados fora do container.

## 🔧 Como Executar a Aplicação (Windows / Linux)

1. Clone o repositório:
   ```bash
   git clone <URL_DO_SEU_REPOSITORIO>
   cd "trab sistemas distribuidos"
   ```

2. Suba os containers com Docker Compose:
   ```bash
   docker-compose up -d --build
   ```
   *(No Windows com versões recentes do Docker Desktop, o comando pode ser apenas `docker compose up -d --build` sem o hífen).*

3. Acesse a aplicação frontend através do navegador acessando a URL:
   👉 **http://localhost**

## 🧪 Como Executar os Testes

Com os containers em execução (passo acima já realizado), abra uma nova aba do terminal na pasta do projeto e navegue até a pasta de testes:

```bash
cd tests
npm install
```

Para rodar os **Testes Unitários e de Integração**:
```bash
npm run test
```

Para rodar o **Teste de Carga / Escalabilidade** (Simulação de múltiplos usuários concorrentes atestando o balanceamento):
```bash
npm run test:load
```

## 🧪 Testes Implementados

Para demonstrar o funcionamento e a resiliência do sistema, os seguintes testes automatizados foram construídos:
*   **Testes Unitários e de Integração:** Validação das lógicas centrais de negócio (login, senhas seguras, restrição de unicidade) e validação de tokens JWT.
*   **Teste de Concorrência/Carga:** Simulação de múltiplos usuários virtuais concorrentes (10 usuários, 50 mensagens em rajada) atestando que a distribuição de carga pelo Nginx e o Pub/Sub do Redis estão funcionando sem perda de mensagens na escalabilidade horizontal.

## 👥 Autores
*   **Marcos Silva**
*   **Arthur Bracarense**
