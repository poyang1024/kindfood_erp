import React, { useState, useEffect, useMemo } from 'react';
import { Container, Header, Button, Message, Confirm, Input } from "semantic-ui-react";
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import firebase from "../utils/firebase";
import "firebase/compat/firestore";
import "firebase/compat/auth";
import DataTable from 'react-data-table-component';
import styled from 'styled-components';

const StyledDataTable = styled(DataTable)`
  .rdt_Table {
    border: 1px solid #e0e0e0;
    border-radius: 8px;
    overflow: hidden;
  }
  .rdt_TableHead {
    background-color: #f5f5f5;
  }
  .rdt_TableHeadRow {
    border-bottom: 2px solid #ddd;
  }
  .rdt_TableRow {
    border-bottom: 1px solid #e0e0e0;
    &:last-child {
      border-bottom: none;
    }
  }
`;

const SearchContainer = styled.div`
  margin-bottom: 1rem;
  max-width: 300px;
`;

function SharedMaterials() {
    const navigate = useNavigate();

    const [user, setUser] = useState(null);
    const [authChecked, setAuthChecked] = useState(false);
    const [materials, setMaterials] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [materialToDelete, setMaterialToDelete] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const unsubscribe = firebase.auth().onAuthStateChanged((user) => {
            setUser(user);
            setAuthChecked(true);
            if (!user) {
                toast.error('需要登入才能查看共用料', {
                    position: "top-center",
                    autoClose: 500,
                    hideProgressBar: false,
                    closeOnClick: true,
                    pauseOnHover: true,
                    draggable: true,
                    onClose: () => navigate('/signin')
                });
            } else {
                fetchSharedMaterials();
            }
        });

        return () => unsubscribe();
    }, [navigate]);

    const fetchSharedMaterials = async () => {
        try {
            const snapshot = await firebase.firestore().collection('shared_materials').get();
            const materialsData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    createdAt: data.createdAt,
                    lastUpdated: data.lastUpdated || null,
                    unitCost: (parseFloat(data.purchaseUnitCost) / parseFloat(data.productUnit)).toFixed(2)
                };
            });
            setMaterials(materialsData);
            setIsLoading(false);
        } catch (error) {
            console.error("Error fetching shared materials: ", error);
            toast.error('獲取共用料時發生錯誤');
            setIsLoading(false);
        }
    };

    const handleEdit = (id) => {
        navigate(`/edit-shared-material/${id}`);
    };

    const handleDelete = (material) => {
        setMaterialToDelete(material);
        setDeleteConfirmOpen(true);
    };

    const confirmDelete = async () => {
        if (materialToDelete) {
            try {
                await firebase.firestore().collection('shared_materials').doc(materialToDelete.id).delete();
                toast.success('共用料已成功刪除');
                fetchSharedMaterials();
            } catch (error) {
                console.error("Error deleting shared material: ", error);
                toast.error('刪除共用料時發生錯誤');
            }
        }
        setDeleteConfirmOpen(false);
    };

    const filteredMaterials = useMemo(() => {
        return materials.filter(material =>
            material.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            material.purchaseUnitCost.toString().includes(searchTerm) ||
            material.productUnit.toString().includes(searchTerm) ||
            material.unitCost.toString().includes(searchTerm)
        );
    }, [materials, searchTerm]);

    const columns = [
        {
            name: '名稱',
            selector: row => row.name,
            sortable: true,
            width: '235px',
        },
        {
            name: '進貨單位成本',
            selector: row => row.purchaseUnitCost,
            sortable: true,
        },
        {
            name: '成品單位',
            selector: row => row.productUnit,
            sortable: true,
        },
        {
            name: '成品單位成本',
            selector: row => row.unitCost,
            sortable: true,
        },
        {
            name: '建立時間',
            selector: row => row.createdAt.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
            sortable: true,
            width: '175px',
        },
        {
            name: '最近更新時間',
            selector: row => row.lastUpdated ? row.lastUpdated.toDate().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }) : '尚未更新',
            sortable: true,
            width: '175px',
        },
        {
            name: '操作',
            cell: row => (
                <>
                    <Button primary onClick={() => handleEdit(row.id)}>修改</Button>
                    <Button secondary onClick={() => navigate(`/shared-material-history/${row.id}`)}>歷史記錄</Button>
                </>
            ),
            width: '210px',
        },
    ];

    if (!authChecked) {
        return <Container><Message>載入中...</Message></Container>;
    }

    return (
        <Container>
            <ToastContainer />
            <Header>查看共用料</Header>
            {user ? (
                isLoading ? (
                    <Message>載入共用料中...</Message>
                ) : (
                    <>
                        <SearchContainer>
                            <Input
                                fluid
                                icon='search'
                                placeholder='搜尋共用料'
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </SearchContainer>
                        <StyledDataTable
                            columns={columns}
                            data={filteredMaterials}
                            pagination
                            highlightOnHover
                            responsive
                        />
                        <Confirm
                            open={deleteConfirmOpen}
                            content="確定要刪除此共用料嗎？"
                            onCancel={() => setDeleteConfirmOpen(false)}
                            onConfirm={confirmDelete}
                            cancelButton='取消'
                            confirmButton='確定'
                        />
                    </>
                )
            ) : (
                <Message error>請先登入後再查看共用料。</Message>
            )}
        </Container>
    );
}

export default SharedMaterials;