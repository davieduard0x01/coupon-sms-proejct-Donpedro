// Arquivo: coupon-sms-project/backend/index.js (VERSÃO FINAL QR CODE E MÚLTIPLOS ACESSOS)

require('dotenv').config();
const express = require('express');
const cors = require('cors'); 
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid'); // Biblioteca para gerar UUIDs

const app = express();
const PORT = process.env.PORT || 3001;

// --- Configurações Fixas ---
const FIXED_COUPON_CODE = "D0nP3dro20"; 

// Configuração CORS (Permite múltiplos frontends)
const corsOptions = {
    // Porta 5173 (Usuário), Porta 5174 (Funcionário/Admin)
    origin: ['http://localhost:5173', 'http://localhost:5174'], 
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
app.use(express.json());

// Inicialização do Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Funções de Ajuda e Middlewares ---

/** Normaliza o número de telefone para o formato E.164 (+1xxxxxxxxxx). */
const normalizePhoneNumber = (number) => {
    const digits = number.replace(/\D/g, '');
    if (number.startsWith('+')) { return number; }
    if (digits.length === 10) { return `+1${digits}`; }
    if (digits.length === 11 && digits.startsWith('1')) { return `+${digits}`; }
    return number; 
};

/** Middleware de Autenticação (Verifica se o usuário existe na tabela users_acesso) */
const authenticateAccess = async (req, res, next) => {
    const token = req.header('X-Auth-Token');
    if (!token) {
        return res.status(401).json({ message: 'Token de autenticação ausente.' });
    }

    try {
        const [usuario, nivel] = token.split(':');
        
        const { data, error } = await supabase
            .from('users_acesso')
            .select('nivel')
            .eq('usuario', usuario)
            .limit(1);

        if (error || !data || data.length === 0) {
            return res.status(401).json({ message: 'Usuário não encontrado ou token inválido.' });
        }
        
        req.user_nivel = data[0].nivel; 
        req.user_usuario = usuario;
        
        next();

    } catch (e) {
        return res.status(401).json({ message: 'Formato de token inválido.' });
    }
};

/** Middleware para restringir o acesso apenas a ADMIN */
const requireAdmin = (req, res, next) => {
    if (req.user_nivel !== 'ADMIN') {
        return res.status(403).json({ message: 'Acesso negado. Requer privilégios de Administrador.' });
    }
    next();
};


// ----------------------------------------------------
// --- ROTAS DO CADASTRO (CLIENTE) - Porta 5173 ---
// ----------------------------------------------------

app.post('/api/register-coupon', async (req, res) => {
    const { name, phone, address } = req.body; 
    
    // LOG: Início da requisição
    console.log('\n--- DIAGNÓSTICO: INÍCIO DO CADASTRO ---');
    console.log(`LOG: Dados recebidos: Nome=${name}, Telefone Original=${phone}`);
    
    // 1. Validação (Endereço é OBRIGATÓRIO)
    if (!name || !phone || !address) {
        console.log('LOG-FAIL: 400 - Campos obrigatórios ausentes.');
        return res.status(400).json({ message: 'Nome, telefone e endereço são obrigatórios.' });
    }
    
    const normalizedNumber = normalizePhoneNumber(phone);
    
    if (!normalizedNumber.startsWith('+1') || normalizedNumber.replace(/\D/g, '').length !== 11) {
        console.log(`LOG-FAIL: 400 - Telefone '${phone}' normalizado para '${normalizedNumber}' é inválido.`);
        return res.status(400).json({ message: 'Formato de número inválido. Use o formato dos EUA.' });
    }

    // LOG CRÍTICO 1: O VALOR NORMALIZADO QUE VAI PARA O BANCO
    console.log(`LOG CRÍTICO 1: Telefone Normalizado para o Banco (UNIQUE KEY): ${normalizedNumber}`);

    // --- LÓGICA DE INSERÇÃO E CAPTURA DE ERRO DE DUPLICIDADE ---
    const couponUUID = uuidv4(); 
    const registrationData = {
        coupon_uuid: couponUUID,
        nome: name,
        telefone: normalizedNumber, 
        endereco: address,
        status_uso: 'NAO_UTILIZADO',
        coupon_code: FIXED_COUPON_CODE, 
    };
    
    try {
        // Tenta a inserção. Se o telefone já existir, o Supabase retornará o erro 23505
        const { error: insertError } = await supabase.from('leads_cupons').insert([registrationData]);
        
        if (insertError) {
             console.error('LOG-FAIL: Erro de inserção do Supabase não-23505:', insertError);
             throw insertError;
        }

        // LOG CRÍTICO 2: SUCESSO DE INSERÇÃO - Se aparecer na duplicidade, a restrição UNIQUE falhou.
        console.log(`LOG CRÍTICO 2: SUCESSO! Novo UUID gerado: ${couponUUID}`);
        
        // SUCESSO: Retorna o UUID para que o frontend gere o QR Code
        return res.status(200).json({ 
            message: `Olá ${name}, cadastro realizado com sucesso!`,
            couponUUID: couponUUID, 
            couponCode: FIXED_COUPON_CODE 
        });
        
    } catch (insertError) {
        
        // 2. TRATAMENTO DE ERRO CRÍTICO (VIOLAÇÃO DE UNICIDADE: 23505)
        if (insertError.code === '23505') {
            
            // LOG CRÍTICO 3: ERRO 23505 CAPTURADO - DUPLICIDADE CONFIRMADA
            console.log(`LOG CRÍTICO 3: DUPLICIDADE DETECTADA (Código 23505). Buscando cupons antigos...`);

            // Busca todos os cupons do usuário existente
            const { data: existingCupons, error: fetchError } = await supabase
                .from('leads_cupons')
                .select('*')
                .eq('telefone', normalizedNumber);
            
            if (fetchError || !existingCupons || existingCupons.length === 0) {
                 console.error('LOG-FAIL: Erro ao buscar cupons após 23505:', fetchError);
                 return res.status(500).json({ message: 'Erro ao buscar cupons antigos após falha de duplicidade.' });
            }

            // LOG CRÍTICO 4: RETORNANDO LISTA DE CUPONS EXISTENTES
            console.log(`LOG CRÍTICO 4: RETORNANDO ${existingCupons.length} cupom(ns) para o usuário.`);

            // Retorna 409 (Conflict) e a lista de cupons para o tratamento de erro no frontend
            return res.status(409).json({ 
                message: `Olá, ${existingCupons[0].nome}. Seu número já está cadastrado.`,
                cupons: existingCupons 
            });
        }
        
        // Outros Erros de Banco de Dados
        console.error('LOG-FAIL: Outro erro de DB/servidor (Não-23505):', insertError);
        return res.status(500).json({ message: 'Erro interno ao salvar dados. Verifique o log.' });
    }
});


// ----------------------------------------------------
// --- ROTAS DE ACESSO (FUNCIONÁRIO & ADMIN) - Porta 5174 ---
// ----------------------------------------------------

/** Rota de Login */
app.post('/auth/login', async (req, res) => {
    const { usuario, senha } = req.body;

    try {
        const { data, error } = await supabase
            .from('users_acesso')
            .select('usuario, nivel')
            .eq('usuario', usuario)
            .eq('senha', senha)
            .limit(1);

        if (error || !data || data.length === 0) {
            return res.status(401).json({ message: 'Credenciais inválidas.' });
        }
        
        // Geração do token simples para o frontend
        const token = `${data[0].usuario}:${data[0].nivel}`;
        return res.status(200).json({ 
            message: 'Login bem-sucedido.', 
            token: token,
            nivel: data[0].nivel
        });

    } catch (dbError) {
        console.error('Erro de login:', dbError);
        return res.status(500).json({ message: 'Erro interno no servidor de autenticação.' });
    }
});

/** Rota de Validação/Scanner (Funcionário) */
app.post('/func/validate', authenticateAccess, async (req, res) => {
    const { couponUUID } = req.body; // Recebe o UUID lido pelo QR Code
    
    if (req.user_nivel !== 'FUNCIONARIO' && req.user_nivel !== 'ADMIN') {
         return res.status(403).json({ message: 'Acesso negado. Requer nível de Funcionário ou Admin.' });
    }
    
    if (!couponUUID) {
        return res.status(400).json({ message: 'O código UUID do cupom é obrigatório.' });
    }

    try {
        // 1. Busca o cupom
        const { data: coupon, error: fetchError } = await supabase
            .from('leads_cupons')
            .select('status_uso, nome')
            .eq('coupon_uuid', couponUUID)
            .limit(1);

        if (fetchError) throw fetchError;
        
        if (!coupon || coupon.length === 0) {
            return res.status(404).json({ message: 'Código QR Inválido. Cupom não encontrado.' });
        }
        
        const currentStatus = coupon[0].status_uso;

        // 2. Verifica o status
        if (currentStatus === 'UTILIZADO') {
            return res.status(409).json({ message: `Cupom já utilizado por ${coupon[0].nome}. Validação negada.` });
        }
        if (currentStatus === 'EXPIRADO') {
            return res.status(409).json({ message: 'Cupom expirado. Validação negada.' });
        }

        // 3. Validação APROVADA: Marca como UTILIZADO (Transação de Uso Único)
        const { error: updateError } = await supabase
            .from('leads_cupons')
            .update({ status_uso: 'UTILIZADO', data_uso: new Date().toISOString() })
            .eq('coupon_uuid', couponUUID);

        if (updateError) throw updateError;
        
        return res.status(200).json({ 
            message: `CUPOM VÁLIDO! Uso registrado para ${coupon[0].nome}.`,
            status: 'VALIDADO',
            nome: coupon[0].nome
        });

    } catch (dbError) {
        console.error('Erro de validação:', dbError);
        return res.status(500).json({ message: 'Erro interno no servidor de validação.' });
    }
});


// ----------------------------------------------------
// --- ROTAS DO PAINEL DE ADMIN - Porta 5174 ---
// ----------------------------------------------------

/** Rota para Obter Leads (Apenas Admin) */
app.get('/admin/leads', authenticateAccess, requireAdmin, async (req, res) => {
    try {
        // Busca todos os dados da tabela leads_cupons
        const { data: leads, error } = await supabase
            .from('leads_cupons')
            .select('coupon_uuid, nome, telefone, endereco, status_uso, data_cadastro, data_uso');

        if (error) throw error;
        
        return res.status(200).json(leads);

    } catch (dbError) {
        console.error('Erro ao buscar leads:', dbError);
        return res.status(500).json({ message: 'Erro interno ao carregar dados.' });
    }
});


// --- Iniciar Servidor ---
app.listen(PORT, () => {
    console.log(`Servidor backend rodando em http://localhost:${PORT}`);
});