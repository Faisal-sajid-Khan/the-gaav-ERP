import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';

export const useFetch = (url, params = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState(null);

  const fetchData = useCallback(async (overrideParams = {}) => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(url, { params: { ...params, ...overrideParams } });
      setData(res.data?.data !== undefined ? res.data.data : res.data);
      if (res.data?.pagination) setPagination(res.data.pagination);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [url, JSON.stringify(params)]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, pagination, refetch: fetchData };
};
