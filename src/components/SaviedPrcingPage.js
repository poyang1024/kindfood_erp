import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Container, Header, Loader, Button, Confirm, Message, Modal, Form } from 'semantic-ui-react';
import firebase from '../utils/firebase';
import DataTable from 'react-data-table-component';
import styled from 'styled-components';
import toast, { Toaster } from 'react-hot-toast';

const StyledContainer = styled(Container)`
  padding: 2rem;
`;

const TopControls = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const ActionButtonGroup = styled.div`
  display: flex;
  gap: 0.5rem;
`;

function SavedPricingPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [savedPricings, setSavedPricings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [editName, setEditName] = useState('');
  const [editNote, setEditNote] = useState('');

  const fetchSavedPricings = useCallback(async () => {
    try {
      const snapshot = await firebase.firestore()
        .collection('pricingHistory')
        .orderBy('createdAt', 'desc')
        .get();
      
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate?.().toLocaleString() || '-'
      }));
      setSavedPricings(data);
    } catch (error) {
      console.error('Error fetching saved pricings:', error);
      toast.error('獲取歷史報價資料時出錯');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = firebase.auth().onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        fetchSavedPricings();
      } else {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [fetchSavedPricings]);

  const handleDelete = useCallback((item) => {
    setItemToDelete(item);
    setConfirmOpen(true);
  }, []);

  const handleEdit = useCallback((item) => {
    setEditingItem(item);
    setEditName(item.name);
    setEditNote(item.note || '');
    setIsEditModalOpen(true);
  }, []);

  const handleApply = useCallback(async (item) => {
    try {
      // 獲取原始的 BOM 表數據結構，但使用保存的方案數據
      const snapshot = await firebase.firestore().collection('bom_tables').get();
      const updatedPricingData = await Promise.all(snapshot.docs.map(async doc => {
        // 在保存的方案數據中找到對應的項目
        const savedItem = item.pricingData.find(saved => saved.id === doc.id);
        if (savedItem) {
          // 如果找到對應項目，使用保存的定價數據
          return {
            ...savedItem,
            // 確保保留所有需要的定價相關欄位
            dealerPrice: savedItem.dealerPrice || '',
            specialPrice: savedItem.specialPrice || '',
            bottomPrice: savedItem.bottomPrice || '',
            dealerMargin: savedItem.dealerMargin || '',
            specialMargin: savedItem.specialMargin || '',
            bottomMargin: savedItem.bottomMargin || '',
            logisticsCostRate: savedItem.logisticsCostRate || '',
            totalCostWithLogistics: savedItem.totalCostWithLogistics || ''
          };
        }
        return null;
      }));
  
      // 過濾掉 null 值並只保留有效數據
      const validPricingData = updatedPricingData.filter(item => item !== null);
  
      // 儲存完整的方案數據，包含方案 ID
      localStorage.setItem('currentPricingData', JSON.stringify({
        id: item.id,              // 加入方案 ID
        pricingData: validPricingData,
        name: item.name,
        note: item.note || ''
      }));
      
      toast.success('已載入報價方案');
      navigate('/dealer-pricing');
    } catch (error) {
      console.error('Error applying pricing scheme:', error);
      toast.error('載入報價方案時發生錯誤');
    }
  }, [navigate]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    try {
      await firebase.firestore()
        .collection('pricingHistory')
        .doc(itemToDelete.id)
        .delete();

      toast.success('報價方案已刪除');
      fetchSavedPricings();
    } catch (error) {
      console.error('Error deleting pricing:', error);
      toast.error('刪除報價方案時出錯');
    }
    setConfirmOpen(false);
    setItemToDelete(null);
  };

  const handleUpdate = async () => {
    if (!editingItem) return;

    try {
      await firebase.firestore()
        .collection('pricingHistory')
        .doc(editingItem.id)
        .update({
          name: editName.trim(),
          note: editNote.trim(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      toast.success('報價方案已更新');
      setIsEditModalOpen(false);
      fetchSavedPricings();
    } catch (error) {
      console.error('Error updating pricing:', error);
      toast.error('更新報價方案時出錯');
    }
  };

  const columns = [
    {
      name: '方案名稱',
      selector: row => row.name,
      sortable: true,
      width: '20%',
    },
    {
      name: '建立時間',
      selector: row => row.createdAt,
      sortable: true,
      width: '20%',
    },
    {
      name: '備註',
      selector: row => row.note || '-',
      sortable: true,
      width: '20%',
    },
    {
      name: '建立者',
      selector: row => row.createdBy?.displayName || row.createdBy.email,
      sortable: true,
      width: '20%',
    },
    {
      name: '操作',
      cell: row => (
        <ActionButtonGroup>
          <Button size='small' primary onClick={() => handleApply(row)}>
            套用
          </Button>
          <Button size='small' secondary onClick={() => handleEdit(row)}>
            編輯
          </Button>
          <Button size='small' negative onClick={() => handleDelete(row)}>
            刪除
          </Button>
        </ActionButtonGroup>
      ),
      width: '15%',
    },
  ];

  const customStyles = {
    table: {
      style: {
        backgroundColor: 'white',
      },
    },
    rows: {
      style: {
        minHeight: '60px',
      },
    },
    headRow: {
      style: {
        backgroundColor: '#f5f5f5',
        borderBottom: '2px solid #ddd',
      },
    },
  };

  if (loading) {
    return (
      <StyledContainer>
        <Loader active>載入中...</Loader>
      </StyledContainer>
    );
  }

  if (!user) {
    return (
      <StyledContainer>
        <Message error>
          <Message.Header>需要登入</Message.Header>
          <p>您需要登入才能查看此頁面。請 <Button color="red" as={Link} to="/signin">登入</Button></p>
        </Message>
      </StyledContainer>
    );
  }

  return (
    <StyledContainer>
      <Toaster position="top-right" />
      
      <TopControls>
        <Header as="h1">經銷歷史報價管理</Header>
        <Button 
          primary 
          as={Link} 
          to="/dealer-pricing"
        >
          返回報價計算
        </Button>
      </TopControls>

      <DataTable
        columns={columns}
        data={savedPricings}
        pagination
        paginationPerPage={10}
        customStyles={customStyles}
        striped
        highlightOnHover
        noDataComponent="目前沒有儲存的報價方案"
      />

      <Confirm
        open={confirmOpen}
        content="確定要刪除這個報價方案嗎？此操作無法復原。"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={confirmDelete}
        cancelButton='取消'
        confirmButton='確定刪除'
      />

      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        size="small"
      >
        <Modal.Header>編輯報價方案</Modal.Header>
        <Modal.Content>
          <Form>
            <Form.Field required>
              <label>方案名稱</label>
              <Form.Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="輸入方案名稱"
              />
            </Form.Field>
            <Form.Field>
              <label>備註</label>
              <Form.Input
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder="輸入備註"
              />
            </Form.Field>
          </Form>
        </Modal.Content>
        <Modal.Actions>
          <Button negative onClick={() => setIsEditModalOpen(false)}>
            取消
          </Button>
          <Button positive onClick={handleUpdate}>
            更新
          </Button>
        </Modal.Actions>
      </Modal>
    </StyledContainer>
  );
}

export default SavedPricingPage;